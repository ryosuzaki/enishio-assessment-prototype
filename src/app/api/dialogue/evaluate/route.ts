import { NextResponse } from "next/server";
import { extractEvidence, computeBandScore, SCORER_MODEL_VERSION } from "@/lib/evaluator";
import { recordRating } from "@/lib/telemetry";

// POST /api/dialogue/evaluate - execute 2-stage AutoSCORE evaluation and record rating
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, learnerId, sessionSeq, transcript, finalArtifact } = body;

    if (!sessionId || !transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { success: false, error: "Missing required transcript parameters" },
        { status: 400 }
      );
    }

    // 1. Stage 1: Evidence extraction (structured output)
    const evidence = await extractEvidence(transcript, finalArtifact || "");

    // 2. Stage 2: Band scoring (0..5 band) strictly on extracted evidence
    const scoring = await computeBandScore(evidence);

    // 3. Record rating to database (ratings is single source of truth) [MVP 4.1.1]
    const ratingRecord = await recordRating({
      sessionId,
      learnerId: learnerId || "anonymous-learner",
      sessionSeq: Number(sessionSeq) || 1,
      stepId: "step-dynamic-fintech-01",
      axisId: "axis_4",
      ratingCategory: scoring.rating_category,
      raterType: "llm",
      raterId: "claude-opus-5",
      scorerModelVersion: SCORER_MODEL_VERSION,
      stimulusRef: "TASK-FINTECH-AUTH-01",
      stimulusType: "generated",
      anchorId: null,
      anchorStatus: null,
      stimulusFeatures: {
        domain: "fintech_security",
        error_types: ["type_A", "type_B", "type_C"],
        target_dimension: "axis_4",
        identified_flaws_count: evidence.identified_flaws_count,
        avoided_false_positives: evidence.avoided_false_positives,
      },
    });

    return NextResponse.json({
      success: true,
      ratingId: ratingRecord.rating_id,
      ratingCategory: scoring.rating_category,
      levelLabel: scoring.level_label,
      evidenceSummary: scoring.evidence_summary,
      diagnosticFeedback: scoring.diagnostic_feedback,
      evidenceComponents: evidence.components,
      scorerModelVersion: SCORER_MODEL_VERSION,
    });
  } catch (error: any) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Evaluation failed" },
      { status: 500 }
    );
  }
}
