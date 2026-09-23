import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  extractEvidence,
  computeBandScore,
  levelLabelFor,
  ScoringUnavailableError,
  getScorerModelVersion,
  resolveConfidenceThreshold,
  getScorerModel,
} from "@/lib/evaluator";
import {
  recordRating,
  resolveSessionContext,
  recordEvidenceComponents,
  recordRelianceMetrics,
  recordLlmCall,
  completeSession,
} from "@/lib/telemetry";
import type { LlmUsage } from "@/lib/llm";
import { getDynamicTask } from "@/data/dynamic-task";
import { getInjectedFlaws } from "@/data/dynamic-task.server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  MAX_ARTIFACT_CHARS,
  MAX_USER_MESSAGE_CHARS,
  parseRequestBody,
} from "@/lib/request-validation";

const STAKES_CONTEXT_VALUES = [
  "formative",
  "education",
  "promotion",
  "selection",
  "verification",
] as const;

const TranscriptItemSchema = z.object({
  turnSeq: z.coerce.number().int().min(0),
  role: z.string().min(1).max(50),
  content: z.string().max(MAX_USER_MESSAGE_CHARS),
});

const EvaluateRequestSchema = z.object({
  sessionId: z.string().min(1),
  taskId: z.string().min(1),
  transcript: z.array(TranscriptItemSchema),
  finalArtifact: z.string().max(MAX_ARTIFACT_CHARS).nullable().optional(),
  stakesContext: z.enum(STAKES_CONTEXT_VALUES).optional(),
});

// POST /api/dialogue/evaluate - execute 2-stage structured scoring pipeline and record rating
export async function POST(req: Request) {
  try {
    const parsed = await parseRequestBody(req, EvaluateRequestSchema, "構造化採点パイプライン評価");
    if (!parsed.ok) return parsed.response;
    const { sessionId, taskId, transcript, finalArtifact, stakesContext } = parsed.data;

    // taskId が未知のIDなら getDynamicTask が投げる（黙って別課題にすり替えない）
    const task = getDynamicTask(taskId);

    // learner_id / session_seq はセッションから引く（リクエストボディを信用しない）
    const session = await resolveSessionContext(sessionId);

    // 採点2回ぶんのトークン使用量とレイテンシを溜めておき、採点が通ってから記録する。
    // **採点が落ちた場合も記録する**——失敗した呼び出しにも課金は発生している。
    const usages: LlmUsage[] = [];
    const collectUsage = (usage: LlmUsage) => usages.push(usage);

    let evidence: Awaited<ReturnType<typeof extractEvidence>>;
    let scoring: Awaited<ReturnType<typeof computeBandScore>>;
    try {
      // 1. Stage 1: Evidence extraction (structured output)
      evidence = await extractEvidence(transcript, finalArtifact || "", taskId, collectUsage);

      // 2. Stage 2: Band scoring (0..5 band) strictly on extracted evidence
      scoring = await computeBandScore(evidence, taskId, collectUsage);
    } finally {
      for (const usage of usages) await recordLlmCall(sessionId, usage);
    }

    // 3. 確信度が閾値を下回る判定はスコアを確定させず、人間の確認待ちとして記録する（W4-3）。
    //    画面は作らない（S0-5 はスコープ外）。記録だけ行う。
    const { threshold: confidenceThreshold, isDemoOverride } = resolveConfidenceThreshold();
    const isPending = scoring.scoring_confidence < confidenceThreshold;

    const stepId = `step-dynamic-${task.task_id}`;

    // 4. 根拠要素の整形（MVP 4.4）。**評点だけ残して根拠を捨てない。**
    //    これが無いと「根拠と得点の対応がログ上で追跡可能」という2段階分離の主張が成立しない。
    const evidenceRecords = evidence.components.map((c) => ({
      turnIndex: c.turn_index,
      quotedSpan: c.quoted_span,
      componentType: c.component_type,
      grounding: c.grounding,
      injectedFlawId: c.injected_flaw_id,
      rationaleSummary: c.rationale_summary,
    }));

    // 5. 適正依存の3指標（MVP 2.3 / 4.4）。
    //    正常箇所のラベルが要るため、正答鍵はサーバ側でのみ参照する。
    const flawMap = getInjectedFlaws(taskId);

    // 評点、根拠要素、適正依存指標、セッション完了（ended_at）を同一トランザクションで不可分に確定させる（RV-E2, RV-K11）。
    // 途中で失敗した場合に孤立した Rating だけが残ることを防ぐ。
    const ratingRecord = await prisma.$transaction(async (tx) => {
      const rating = await recordRating(
        {
          sessionId,
          learnerId: session.learner_id,
          sessionSeq: session.session_seq,
          stepId,
          axisId: "axis_4",
          ratingCategory: isPending ? null : scoring.rating_category,
          raterType: isPending ? "pending_human" : "llm",
          raterId: isPending ? "awaiting-human-review" : getScorerModel(),
          scorerModelVersion: getScorerModelVersion(),
          stimulusRef: task.task_id,
          stimulusType: "generated",
          anchorId: null,
          anchorStatus: null,
          stakesContext,
          scoringConfidence: scoring.scoring_confidence,
          // 深掘りが1手も入っていないセッションでは null が返る。0 で埋めない。
          probeConsistencyScore: evidence.probe_consistency?.score ?? null,
          stimulusFeatures: {
            domain: task.domain,
            error_types: task.stimulus_features.injected_flaw_types,
            target_dimension: task.target_dimension,
            variable_count: task.stimulus_features.variable_count,
            tradeoff_complexity: task.stimulus_features.tradeoff_complexity,
            jargon_density: task.stimulus_features.jargon_density,
            identified_flaws_count: evidence.identified_flaws_count,
            avoided_false_positives: evidence.avoided_false_positives,
            // 保留になった場合、モデルが提示していたバンドは監査のため残す（確定値ではない）
            proposed_rating_category: isPending ? scoring.rating_category : undefined,
          },
        },
        tx
      );

      await recordEvidenceComponents(rating.rating_id, sessionId, evidenceRecords, tx);

      await recordRelianceMetrics(
        {
          sessionId,
          stepId,
          flawIds: flawMap.filter((f) => f.is_flaw).map((f) => f.flaw_id),
          validSpanIds: flawMap.filter((f) => !f.is_flaw).map((f) => f.flaw_id),
          components: evidenceRecords,
        },
        tx
      );

      await completeSession(sessionId, new Date(), tx);

      return rating;
    });

    return NextResponse.json({
      success: true,
      ratingId: ratingRecord.rating_id,
      isPendingHumanReview: isPending,
      ratingCategory: isPending ? null : scoring.rating_category,
      levelLabel: isPending ? null : levelLabelFor(scoring.rating_category),
      scoringConfidence: scoring.scoring_confidence,
      confidenceThreshold,
      isDemoThresholdOverride: isDemoOverride,
      evidenceSummary: scoring.evidence_summary,
      diagnosticFeedback: scoring.diagnostic_feedback,
      evidenceComponents: evidence.components,
      probeConsistency: evidence.probe_consistency ?? null,
      scorerModelVersion: getScorerModelVersion(),
      stakesContext: ratingRecord.stakes_context,
    });
  } catch (error: unknown) {
    if (error instanceof ScoringUnavailableError) {
      // 採点できないときに推測値で埋めない。埋めると「LLMが採点した」という
      // 偽のログが ratings に残り、scorer_model_version による追跡可能性が崩れる。
      return apiErrorResponse(`Scoring unavailable at stage '${error.stage}'`, error, "Evaluation failed", {
        status: 503,
        extra: { stage: error.stage, scoringUnavailable: true },
      });
    }
    return apiErrorResponse("Evaluation error", error, "Evaluation failed");
  }
}
