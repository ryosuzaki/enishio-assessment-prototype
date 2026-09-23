import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import { prismaErrorCode } from "@/lib/error-message";
import type { LlmUsage } from "@/lib/llm";
import { v5 as uuidv5 } from "uuid";

// Enishio standard namespace for learner_id generation [D-28, D-42]
export const ENISHIO_LEARNER_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * Generate deterministic learner_id using UUIDv5 with tenant namespace separation
 */
export function generateLearnerId(tenantNamespace: string, rawUserId: string): string {
  const combined = `${tenantNamespace}:${rawUserId}`;
  return uuidv5(combined, ENISHIO_LEARNER_NAMESPACE);
}

/**
 * Start a new session for a learner and assign the next incremental session_seq.
 * sessions has a unique constraint on (learner_id, session_seq); a concurrent start
 * loses the race and is retried rather than silently producing a duplicate seq.
 *
 * `tenantNamespace` は `learnerId` の採番根拠そのものである（`generateLearnerId`）。
 * **同じものを `tenants` 側にも残す。**識別子の中にだけ畳み込まれていると、
 * どの組織の受講者かを後から復元できない。
 */
export async function startSession(learnerId: string, tenantNamespace: string) {
  const tenant = await prisma.tenant.upsert({
    where: { tenant_namespace: tenantNamespace },
    update: {},
    create: { tenant_namespace: tenantNamespace },
  });

  await prisma.learner.upsert({
    where: { learner_id: learnerId },
    update: {},
    create: { learner_id: learnerId, tenant_id: tenant.tenant_id },
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const lastSession = await prisma.session.findFirst({
      where: { learner_id: learnerId },
      orderBy: { session_seq: "desc" },
      select: { session_seq: true },
    });

    const nextSeq = (lastSession?.session_seq ?? 0) + 1;

    try {
      const session = await prisma.session.create({
        data: { learner_id: learnerId, session_seq: nextSeq },
      });
      return {
        session_id: session.session_id,
        session_seq: session.session_seq,
        started_at: session.started_at,
      };
    } catch (e: unknown) {
      // P2002 = unique constraint violation on (learner_id, session_seq)
      if (prismaErrorCode(e) !== "P2002") throw e;
    }
  }

  throw new Error("Failed to allocate session_seq after 5 attempts");
}

/**
 * Resolve learner_id / session_seq from the session itself.
 *
 * These must never be taken from the request body: the client could attribute a
 * rating to another learner, and a client-supplied session_seq can drift away
 * from the stored one (session_seq is not recoverable from timestamps).
 */
export async function resolveSessionContext(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { session_id: sessionId },
    select: { session_id: true, learner_id: true, session_seq: true },
  });
  if (!session) {
    throw new Error(`Unknown session_id: ${sessionId}`);
  }
  return session;
}

/**
 * Record a prompt turn (user or AI response) in the session
 */
/**
 * 対話の1ターンを記録する（MVP 4.4 `prompt_turns[]`）。
 *
 * `mediator` は AI同僚（`assistant`）とは別の役割である——AI同僚は成果物を書く相手、
 * メディエーターは受講者の判断を引き出す相手（MVP 2.1 ステップ7・8）。
 * **同じ role にまとめてはならない。**受講者が検証したのかメディエーターが問うたのかを
 * 事後に分離できなくなり、第1エージェントが応答の一貫性を判定できなくなる。
 */
export type PromptTurnRole = "user" | "assistant" | "system" | "mediator";

export async function recordPromptTurn(
  sessionId: string,
  turnSeq: number,
  role: PromptTurnRole,
  content: string,
  modelVersion?: string | null
) {
  return await prisma.promptTurn.create({
    data: {
      session_id: sessionId,
      turn_seq: turnSeq,
      role,
      content,
      model_version: modelVersion ?? null,
    },
  });
}

/**
 * Record an artifact edit distance checkpoint
 */
export async function recordEditDistance(
  sessionId: string,
  editDistance: number,
  currentText?: string
) {
  return await prisma.artifactEditDistanceSeries.create({
    data: {
      session_id: sessionId,
      edit_distance: editDistance,
      current_text: currentText ?? null,
    },
  });
}

export interface InjectedFlawRecord {
  flaw_id: string;
  flaw_type: string;
  span_text: string;
  is_flaw: boolean;
  description: string;
}

/**
 * Record the injected flaw map for a session, including the deliberately normal
 * spans (is_flaw = false). Without the normal-span labels, over-flagging cannot
 * be distinguished from correct detection [P-15, MVP 4.4].
 */
export async function recordInjectedFlawMap(sessionId: string, flaws: InjectedFlawRecord[]) {
  const result = await prisma.injectedFlawMap.createMany({
    data: flaws.map((f) => ({
      session_id: sessionId,
      flaw_id: f.flaw_id,
      flaw_type: f.flaw_type,
      span_text: f.span_text,
      is_flaw: f.is_flaw,
      description: f.description,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export interface RecordRatingParams {
  sessionId: string;
  learnerId: string;
  sessionSeq: number;
  stepId: string;
  axisId: string; // e.g. "axis_4"
  /** null = not scored (unscored anchor / awaiting human confirmation) */
  ratingCategory: number | null;
  raterType: "llm" | "human" | "pending_human";
  raterId: string;
  scorerModelVersion: string; // e.g. "gpt-5.6-luna/extract-v1/score-v1"
  stimulusRef: string;
  stimulusType: "generated" | "anchor";
  anchorId?: string | null;
  anchorStatus?: "pretest" | "operational" | "verification" | "retired" | null;
  /** [D-67] 決定2：用途の列挙。省略時は "formative"（Phase 1） */
  stakesContext?:
    | "formative"
    | "education"
    | "promotion"
    | "selection"
    | "verification";
  stimulusFeatures: Record<string, any>;
  scoringConfidence?: number | null;
  /**
   * ソクラテス型深掘り（MVP 2.1 ステップ7）への応答の一貫性（MVP 4.4）。
   * 深掘りが1回も走らなかったセッションでは null にする。0 を入れてはならない
   * ——「一貫していなかった」と「そもそも問うていない」は別である。
   */
  probeConsistencyScore?: number | null;
}

/**
 * Record a rating entry (ratings is the single source of truth for evaluation)
 * Enforces anchor_id and anchor_status when stimulus_type === 'anchor' [D-50, D-51]
 */
export async function recordRating(params: RecordRatingParams, tx?: Prisma.TransactionClient) {
  if (params.stimulusType === "anchor") {
    if (!params.anchorId || !params.anchorStatus) {
      throw new Error(
        "Validation error: anchor_id and anchor_status are mandatory when stimulus_type is 'anchor'"
      );
    }
  }

  if (params.ratingCategory !== null) {
    if (params.ratingCategory < 0 || params.ratingCategory > 5) {
      throw new Error(
        `Validation error: rating_category must be between 0 and 5, received: ${params.ratingCategory}`
      );
    }
  } else if (params.raterType !== "pending_human") {
    throw new Error(
      "Validation error: rating_category may only be null when rater_type is 'pending_human'"
    );
  }

  const client = tx ?? prisma;
  return await client.rating.create({
    data: {
      session_id: params.sessionId,
      learner_id: params.learnerId,
      session_seq: params.sessionSeq,
      step_id: params.stepId,
      axis_id: params.axisId,
      rating_category: params.ratingCategory,
      rater_type: params.raterType,
      rater_id: params.raterId,
      scorer_model_version: params.scorerModelVersion,
      stimulus_ref: params.stimulusRef,
      stimulus_type: params.stimulusType,
      anchor_id: params.anchorId ?? null,
      anchor_status: params.anchorStatus ?? null,
      // [D-67] 決定2 / MVP 4.1.1：全応答に付す。本プロトタイプは Phase 1 相当のため既定は "formative"。
      stakes_context: params.stakesContext ?? "formative",
      stimulus_features: params.stimulusFeatures,
      scoring_confidence: params.scoringConfidence ?? null,
      probe_consistency_score: params.probeConsistencyScore ?? null,
    },
  });
}

export interface RecordAnchorResponseParams {
  sessionId: string;
  anchorId: string;
  anchorStatus: string;
  /** [D-67] 決定2：用途の列挙。省略時は "formative"（Phase 1） */
  stakesContext?:
    | "formative"
    | "education"
    | "promotion"
    | "selection"
    | "verification";
  /** "v1-static"（退役）| "v2-sct"（現行・[D-83]） */
  formatVersion?: string;
  // v1（退役形式）。v2 の応答では null が入る。
  q1Selection?: string | null;
  q2Selection?: string | null;
  q1DurationMs?: number | null;
  q2DurationMs?: number | null;
  // v2（4段構成の疑似対話形式・[D-83]）
  stage1Selection?: string | null;
  /** 類型C（不備なし）では段階2を出題しないため null */
  stage2Selection?: string | null;
  /** -2..+2 の判断の移動 */
  stage3Selection?: number | null;
  /** 段階3': 新情報を含まない反論の後の再回答（-2..+2）。stage3 との差分が迎合の指標 */
  stage3bSelection?: number | null;
  stage3bDurationMs?: number | null;
  /** 段階2の提示順（例 "C,A,D,B"）。記録しないと応答を解釈できない */
  stage2Order?: string | null;
  stage1DurationMs?: number | null;
  stage2DurationMs?: number | null;
  stage3DurationMs?: number | null;
  confidence: number;
}

/**
 * Record an anchor item response without assigning a score [MVP 2.6.2]
 */
export async function recordAnchorResponse(params: RecordAnchorResponseParams) {
  return await prisma.anchorResponse.create({
    data: {
      session_id: params.sessionId,
      anchor_id: params.anchorId,
      anchor_status: params.anchorStatus,
      // [D-67] 決定2
      stakes_context: params.stakesContext ?? "formative",
      format_version: params.formatVersion ?? "v1-static",
      q1_selection: params.q1Selection ?? null,
      q2_selection: params.q2Selection ?? null,
      q1_duration_ms: params.q1DurationMs ?? null,
      q2_duration_ms: params.q2DurationMs ?? null,
      stage1_selection: params.stage1Selection ?? null,
      stage2_selection: params.stage2Selection ?? null,
      stage3_selection: params.stage3Selection ?? null,
      stage3b_selection: params.stage3bSelection ?? null,
      stage3b_duration_ms: params.stage3bDurationMs ?? null,
      stage2_order: params.stage2Order ?? null,
      stage1_duration_ms: params.stage1DurationMs ?? null,
      stage2_duration_ms: params.stage2DurationMs ?? null,
      stage3_duration_ms: params.stage3DurationMs ?? null,
      confidence: params.confidence,
    },
  });
}

export const DISAGREEMENT_DIRECTIONS = [
  "too_high",
  "too_low",
  "axis_mismatch",
  "evidence_wrong",
] as const;
export type DisagreementDirection = (typeof DISAGREEMENT_DIRECTIONS)[number];

export const ACTOR_ROLES = ["learner", "supervisor", "hr"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export interface RecordScoreFeedbackParams {
  ratingId: string;
  sessionId: string;
  actorRole: ActorRole;
  disagreementDirection: DisagreementDirection;
  freeTextReason: string; // Mandatory [P-12]
  citedEvidenceRef?: string | null;
  scorerModelVersion: string;
  resolution?: string | null;
}

/**
 * Record feedback or dispute on a rating [MVP 4.5]
 */
export async function recordScoreFeedback(params: RecordScoreFeedbackParams) {
  if (!params.freeTextReason || params.freeTextReason.trim().length === 0) {
    throw new Error("Validation error: free_text_reason is mandatory for score feedback [P-12]");
  }
  if (!DISAGREEMENT_DIRECTIONS.includes(params.disagreementDirection)) {
    throw new Error(
      `Validation error: disagreement_direction must be one of ${DISAGREEMENT_DIRECTIONS.join(" / ")} [MVP 4.5]`
    );
  }
  if (!ACTOR_ROLES.includes(params.actorRole)) {
    throw new Error(
      `Validation error: actor_role must be one of ${ACTOR_ROLES.join(" / ")} [MVP 4.5]`
    );
  }

  return await prisma.scoreFeedback.create({
    data: {
      rating_id: params.ratingId,
      session_id: params.sessionId,
      actor_role: params.actorRole,
      disagreement_direction: params.disagreementDirection,
      free_text_reason: params.freeTextReason.trim(),
      cited_evidence_ref: params.citedEvidenceRef ?? null,
      scorer_model_version: params.scorerModelVersion,
      resolution: params.resolution ?? null,
    },
  });
}

export interface RecordPreliminaryJudgementParams {
  sessionId: string;
  stepId: string;
  action: "approve" | "remand" | "comment";
  justification: string;
}

/**
 * Record CFF preliminary judgement and mandatory justification [MVP 2.5, 4.4, T-17b, D-80]
 * Must be executed before showing AI evaluation report (Force Decision First).
 * Justification is mandatory for all decisions (Mandatory Justification).
 */
export async function recordPreliminaryJudgement(params: RecordPreliminaryJudgementParams) {
  if (!params.justification || params.justification.trim().length === 0) {
    throw new Error(
      "Validation error: justification is mandatory for preliminary judgement [MVP 2.5, T-17b]"
    );
  }
  if (params.action !== "approve" && params.action !== "remand" && params.action !== "comment") {
    throw new Error(
      `Validation error: action must be 'approve', 'remand', or 'comment', received: ${params.action}`
    );
  }

  return await prisma.learnerPreliminaryJudgement.create({
    data: {
      session_id: params.sessionId,
      step_id: params.stepId,
      action: params.action,
      justification: params.justification.trim(),
    },
  });
}

export interface VerificationFocusItem {
  focusSeq: number;
  lineStart?: number | null;
  lineEnd?: number | null;
  selectedText: string;
  note?: string | null;
}

/**
 * Record verification focus sequence (selected code/artifact spans in order of examination) [MVP 4.4, T-17b]
 */
export async function recordVerificationFocusSequence(
  sessionId: string,
  items: VerificationFocusItem[]
) {
  if (!items || items.length === 0) return 0;
  const result = await prisma.verificationFocusSequence.createMany({
    data: items.map((item) => ({
      session_id: sessionId,
      focus_seq: item.focusSeq,
      line_start: item.lineStart ?? null,
      line_end: item.lineEnd ?? null,
      selected_text: item.selectedText,
      note: item.note ?? null,
    })),
    skipDuplicates: true,
  });
  return result.count;
}


/**
 * 第1エージェントが抽出した根拠要素を永続化する（MVP 4.4 `evidence_components[]`）。
 *
 * **評点だけを残して根拠を捨ててはならない。**2段階分離の主張——「抽出結果のみを
 * 採点入力にすることで、根拠と得点の対応が事後に追跡できる」——は、抽出結果が
 * ログに残って初めて成立する。後から足しても過去セッション分は戻らない。
 */
export interface EvidenceComponentRecord {
  turnIndex: number;
  quotedSpan: string;
  componentType: string;
  grounding?: string | null;
  injectedFlawId?: string | null;
  rationaleSummary: string;
}

export async function recordEvidenceComponents(
  ratingId: string,
  sessionId: string,
  components: EvidenceComponentRecord[],
  tx?: Prisma.TransactionClient
) {
  if (!components || components.length === 0) return 0;
  const client = tx ?? prisma;
  const result = await client.evidenceComponent.createMany({
    data: components.map((c) => ({
      rating_id: ratingId,
      session_id: sessionId,
      turn_index: c.turnIndex,
      quoted_span: c.quotedSpan,
      component_type: c.componentType,
      grounding: c.grounding ?? null,
      injected_flaw_id: c.injectedFlawId ?? null,
      rationale_summary: c.rationaleSummary,
    })),
  });
  return result.count;
}

/**
 * 適正依存の3指標を算出して記録する（MVP 2.3 / 4.4 `reliance_metrics`）。
 *
 * **算出はセッション単位で完結させる。**複数セッションを横断して平均・相関・一致率を
 * 取ってはならない（`[P-17]` 判定基準②。稼働前に統計量を出す作業になる）。
 *
 * 操作的定義（本実装で凍結し、`operationalization` に文字列で残す）:
 * - 仕込み不備（is_flaw = true）: `flaw_detection` の根拠要素が当該 flaw_id に紐づいて
 *   いれば「棄却・修正」、紐づいていなければ「採択」（＝指摘せず通した）として数える。
 * - 正常箇所（is_flaw = false）: `false_positive_critique` として指摘されていれば
 *   「棄却」、指摘が無ければ「採択」として数える。
 *
 * ⚠️ **本実装では Automation Bias Index は Correct Self-Reliance の補数になる。**
 * スパン単位の明示的な採択／棄却をまだ取っていないためであり、3指標が独立に
 * 測れているわけではない。この制約を隠さずに記録する。
 */
export interface RelianceMetricsInput {
  sessionId: string;
  stepId: string;
  /** このセッションで提示した仕込み不備のID（is_flaw = true） */
  flawIds: string[];
  /** このセッションで提示した正常箇所のID（is_flaw = false） */
  validSpanIds: string[];
  /** 第1エージェントの抽出結果 */
  components: EvidenceComponentRecord[];
}

export const RELIANCE_OPERATIONALIZATION =
  "flaw: flaw_detection が当該 flaw_id に紐づけば棄却・修正、無ければ採択。" +
  "valid: false_positive_critique が紐づけば棄却、無ければ採択。" +
  "スパン単位の明示的採択／棄却は未取得のため automation_bias_index は " +
  "correct_self_reliance の補数になる（3指標は独立ではない）。";

export async function recordRelianceMetrics(
  input: RelianceMetricsInput,
  tx?: Prisma.TransactionClient
) {
  const { sessionId, stepId, flawIds, validSpanIds, components } = input;
  const client = tx ?? prisma;

  const detectedFlawIds = new Set(
    components
      .filter((c) => c.componentType === "flaw_detection" && c.injectedFlawId)
      .map((c) => c.injectedFlawId as string)
  );
  const overCalledValidIds = new Set(
    components
      .filter((c) => c.componentType === "false_positive_critique" && c.injectedFlawId)
      .map((c) => c.injectedFlawId as string)
  );

  const flawCount = flawIds.length;
  const validCount = validSpanIds.length;

  const detected = flawIds.filter((id) => detectedFlawIds.has(id)).length;
  const overCalled = validSpanIds.filter((id) => overCalledValidIds.has(id)).length;

  // 分母が0のときは割り算をしない。0 を入れると「該当箇所が無かった」と
  // 「1件も正しく扱えなかった」が区別できなくなる。
  const correctSelfReliance = flawCount > 0 ? detected / flawCount : null;
  const automationBiasIndex = flawCount > 0 ? (flawCount - detected) / flawCount : null;
  const correctAiReliance = validCount > 0 ? (validCount - overCalled) / validCount : null;

  return await client.relianceMetrics.upsert({
    where: { session_id_step_id: { session_id: sessionId, step_id: stepId } },
    update: {
      correct_ai_reliance: correctAiReliance,
      correct_self_reliance: correctSelfReliance,
      automation_bias_index: automationBiasIndex,
      valid_span_count: validCount,
      flaw_span_count: flawCount,
      operationalization: RELIANCE_OPERATIONALIZATION,
    },
    create: {
      session_id: sessionId,
      step_id: stepId,
      correct_ai_reliance: correctAiReliance,
      correct_self_reliance: correctSelfReliance,
      automation_bias_index: automationBiasIndex,
      valid_span_count: validCount,
      flaw_span_count: flawCount,
      operationalization: RELIANCE_OPERATIONALIZATION,
    },
  });
}

/**
 * セッションを完了状態として記録する（ended_at を更新する）。[RV-K11]
 */
export async function completeSession(
  sessionId: string,
  endedAt: Date = new Date(),
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  return await client.session.update({
    where: { session_id: sessionId },
    data: { ended_at: endedAt },
  });
}

/**
 * 画面外滞在時間を加算する（MVP 4.4 `window_blur_duration_sec`）。
 *
 * **判定には一切用いず記録のみ。**Phase 3 の多層防衛の資産である。
 * 採点・保留判定・レポートのどこからも参照してはならない。
 */
export async function accumulateWindowBlurDuration(sessionId: string, deltaSec: number) {
  const delta = Math.max(0, Math.round(deltaSec));
  if (delta === 0) return null;
  return await prisma.session.update({
    where: { session_id: sessionId },
    data: { window_blur_duration_sec: { increment: delta } },
  });
}

/**
 * ソクラテス型深掘り・What-if注入の1手を記録する（MVP 2.1 ステップ7・8）。
 *
 * `state_estimate` と `selection_rationale` を必ず残す。**なぜその問いを選んだかが
 * 残らなければ、媒介は「記述可能・再現可能・監査可能な人工物」ではなくなる** `[D-30]`。
 */
export interface MediationProbeRecord {
  sessionId: string;
  turnSeq: number;
  probeMove: string;
  probeText: string;
  stateEstimate: Record<string, any>;
  selectionRationale: string;
  mediatorModelVersion: string;
}

export async function recordMediationProbe(record: MediationProbeRecord) {
  return await prisma.mediationProbe.create({
    data: {
      session_id: record.sessionId,
      turn_seq: record.turnSeq,
      probe_move: record.probeMove,
      probe_text: record.probeText,
      state_estimate: record.stateEstimate,
      selection_rationale: record.selectionRationale,
      mediator_model_version: record.mediatorModelVersion,
    },
  });
}

/**
 * LLM 呼び出し1回ぶんの使用量とレイテンシを記録する。
 *
 * **採点だけでなく対話・深掘りも記録する。**毎ターン全対話ログを再送する対話側が
 * 実際には最大の費目であり、採点分だけ数えると原価を取り違える。
 *
 * 記録に失敗しても本処理は止めない。**課金の記録のために採点結果を失うほうが損である。**
 */
export async function recordLlmCall(sessionId: string, usage: LlmUsage) {
  try {
    return await prisma.llmCall.create({
      data: {
        session_id: sessionId,
        purpose: usage.purpose,
        model: usage.model,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        reasoning_tokens: usage.reasoningTokens,
        total_tokens: usage.totalTokens,
        latency_ms: usage.latencyMs,
      },
    });
  } catch (e) {
    console.error("LLM 使用量の記録に失敗しました（本処理は継続します）:", e);
    return null;
  }
}
