import { prisma } from "../db";
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
 */
export async function startSession(learnerId: string) {
  await prisma.learner.upsert({
    where: { learner_id: learnerId },
    update: {},
    create: { learner_id: learnerId },
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
    } catch (e: any) {
      // P2002 = unique constraint violation on (learner_id, session_seq)
      if (e?.code !== "P2002") throw e;
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
export async function recordPromptTurn(
  sessionId: string,
  turnSeq: number,
  role: "user" | "assistant" | "system",
  content: string
) {
  return await prisma.promptTurn.create({
    data: {
      session_id: sessionId,
      turn_seq: turnSeq,
      role,
      content,
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
  scorerModelVersion: string; // e.g. "claude-opus-5/extract-v1/score-v1"
  stimulusRef: string;
  stimulusType: "generated" | "anchor";
  anchorId?: string | null;
  anchorStatus?: "pretest" | "operational" | "retired" | null;
  stimulusFeatures: Record<string, any>;
  scoringConfidence?: number | null;
}

/**
 * Record a rating entry (ratings is the single source of truth for evaluation)
 * Enforces anchor_id and anchor_status when stimulus_type === 'anchor' [D-50, D-51]
 */
export async function recordRating(params: RecordRatingParams) {
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

  return await prisma.rating.create({
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
      stimulus_features: params.stimulusFeatures,
      scoring_confidence: params.scoringConfidence ?? null,
    },
  });
}

export interface RecordAnchorResponseParams {
  sessionId: string;
  anchorId: string;
  anchorStatus: string;
  q1Selection: string;
  q2Selection: string;
  confidence: number;
  q1DurationMs: number;
  q2DurationMs: number;
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
      q1_selection: params.q1Selection,
      q2_selection: params.q2Selection,
      confidence: params.confidence,
      q1_duration_ms: params.q1DurationMs,
      q2_duration_ms: params.q2DurationMs,
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
  action: "approve" | "remand";
  selfEstimatedScore: number; // 0..5
  justification: string;
}

/**
 * Record CFF preliminary judgement and mandatory justification [MVP 2.5, 4.4, T-17b]
 * Must be executed before showing AI evaluation report (Force Decision First).
 * Justification is mandatory for both approval and remand (Mandatory Justification).
 */
export async function recordPreliminaryJudgement(params: RecordPreliminaryJudgementParams) {
  if (!params.justification || params.justification.trim().length === 0) {
    throw new Error(
      "Validation error: justification is mandatory for preliminary judgement [MVP 2.5, T-17b]"
    );
  }
  if (params.selfEstimatedScore < 0 || params.selfEstimatedScore > 5) {
    throw new Error(
      `Validation error: self_estimated_score must be between 0 and 5, received: ${params.selfEstimatedScore}`
    );
  }
  if (params.action !== "approve" && params.action !== "remand") {
    throw new Error(
      `Validation error: action must be 'approve' or 'remand', received: ${params.action}`
    );
  }

  return await (prisma as any).learnerPreliminaryJudgement.create({
    data: {
      session_id: params.sessionId,
      step_id: params.stepId,
      action: params.action,
      self_estimated_score: params.selfEstimatedScore,
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
  const result = await (prisma as any).verificationFocusSequence.createMany({
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

