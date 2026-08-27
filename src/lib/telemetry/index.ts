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
 * Start a new session for a learner and assign the next incremental session_seq
 */
export async function startSession(learnerId: string) {
  // Ensure learner exists
  await prisma.learner.upsert({
    where: { learner_id: learnerId },
    update: {},
    create: { learner_id: learnerId },
  });

  // Determine next session_seq for this learner
  const lastSession = await prisma.session.findFirst({
    where: { learner_id: learnerId },
    orderBy: { session_seq: "desc" },
    select: { session_seq: true },
  });

  const nextSeq = (lastSession?.session_seq ?? 0) + 1;

  const session = await prisma.session.create({
    data: {
      learner_id: learnerId,
      session_seq: nextSeq,
    },
  });

  return {
    session_id: session.session_id,
    session_seq: session.session_seq,
    started_at: session.started_at,
  };
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

export interface RecordRatingParams {
  sessionId: string;
  learnerId: string;
  sessionSeq: number;
  stepId: string;
  axisId: string; // e.g. "axis_4"
  ratingCategory: number; // 0..5
  raterType: "llm" | "human";
  raterId: string;
  scorerModelVersion: string; // e.g. "claude-opus-5/extract-v1/score-v1"
  stimulusRef: string;
  stimulusType: "generated" | "anchor";
  anchorId?: string | null;
  anchorStatus?: "pretest" | "operational" | "retired" | null;
  stimulusFeatures: Record<string, any>;
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

  if (params.ratingCategory < 0 || params.ratingCategory > 5) {
    throw new Error(
      `Validation error: rating_category must be between 0 and 5, received: ${params.ratingCategory}`
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
    },
  });
}

export interface RecordAnchorResponseParams {
  sessionId: string;
  anchorId: string;
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
      q1_selection: params.q1Selection,
      q2_selection: params.q2Selection,
      confidence: params.confidence,
      q1_duration_ms: params.q1DurationMs,
      q2_duration_ms: params.q2DurationMs,
    },
  });
}

export interface RecordScoreFeedbackParams {
  ratingId: string;
  actorRole: "learner" | "evaluator";
  disagreementDirection: "too_low" | "too_high" | "unclear";
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

  return await prisma.scoreFeedback.create({
    data: {
      rating_id: params.ratingId,
      actor_role: params.actorRole,
      disagreement_direction: params.disagreementDirection,
      free_text_reason: params.freeTextReason.trim(),
      cited_evidence_ref: params.citedEvidenceRef ?? null,
      scorer_model_version: params.scorerModelVersion,
      resolution: params.resolution ?? null,
    },
  });
}
