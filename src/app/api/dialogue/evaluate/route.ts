import { NextResponse } from "next/server";
import {
  extractEvidence,
  computeBandScore,
  levelLabelFor,
  ScoringUnavailableError,
  SCORER_MODEL_VERSION,
  HITL_CONFIDENCE_THRESHOLD,
} from "@/lib/evaluator";
import { recordRating, resolveSessionContext } from "@/lib/telemetry";

// POST /api/dialogue/evaluate - execute 2-stage AutoSCORE evaluation and record rating
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, transcript, finalArtifact } = body;

    if (!sessionId || !transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { success: false, error: "Missing required transcript parameters" },
        { status: 400 }
      );
    }

    // learner_id / session_seq はセッションから引く（リクエストボディを信用しない）
    const session = await resolveSessionContext(sessionId);

    // 1. Stage 1: Evidence extraction (structured output)
    const evidence = await extractEvidence(transcript, finalArtifact || "");

    // 2. Stage 2: Band scoring (0..5 band) strictly on extracted evidence
    const scoring = await computeBandScore(evidence);

    // 3. 確信度が閾値を下回る判定はスコアを確定させず、人間の確認待ちとして記録する（W4-3）。
    //    画面は作らない（S0-5 はスコープ外）。記録だけ行う。
    const isPending = scoring.scoring_confidence < HITL_CONFIDENCE_THRESHOLD;

    const ratingRecord = await recordRating({
      sessionId,
      learnerId: session.learner_id,
      sessionSeq: session.session_seq,
      stepId: "step-dynamic-fintech-01",
      axisId: "axis_4",
      ratingCategory: isPending ? null : scoring.rating_category,
      raterType: isPending ? "pending_human" : "llm",
      raterId: isPending ? "awaiting-human-review" : "claude-opus-5",
      scorerModelVersion: SCORER_MODEL_VERSION,
      stimulusRef: "TASK-FINTECH-AUTH-01",
      stimulusType: "generated",
      anchorId: null,
      anchorStatus: null,
      scoringConfidence: scoring.scoring_confidence,
      stimulusFeatures: {
        domain: "fintech_security",
        error_types: ["type_A", "type_B", "type_C"],
        target_dimension: "axis_4",
        identified_flaws_count: evidence.identified_flaws_count,
        avoided_false_positives: evidence.avoided_false_positives,
        // 保留になった場合、モデルが提示していたバンドは監査のため残す（確定値ではない）
        proposed_rating_category: isPending ? scoring.rating_category : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      ratingId: ratingRecord.rating_id,
      isPendingHumanReview: isPending,
      ratingCategory: isPending ? null : scoring.rating_category,
      levelLabel: isPending ? null : levelLabelFor(scoring.rating_category),
      scoringConfidence: scoring.scoring_confidence,
      evidenceSummary: scoring.evidence_summary,
      diagnosticFeedback: scoring.diagnostic_feedback,
      evidenceComponents: evidence.components,
      scorerModelVersion: SCORER_MODEL_VERSION,
    });
  } catch (error: any) {
    if (error instanceof ScoringUnavailableError) {
      // 採点できないときに推測値で埋めない。埋めると「LLMが採点した」という
      // 偽のログが ratings に残り、scorer_model_version による再現性が崩れる。
      console.error(`Scoring unavailable at stage '${error.stage}':`, error.message);
      return NextResponse.json(
        { success: false, error: error.message, stage: error.stage, scoringUnavailable: true },
        { status: 503 }
      );
    }
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Evaluation failed" },
      { status: 500 }
    );
  }
}
