import { NextResponse } from "next/server";
import { recordScoreFeedback } from "@/lib/telemetry";

// POST /api/feedback - record learner score dispute or feedback [MVP 4.5]
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ratingId, disagreementDirection, freeTextReason, citedEvidenceRef, scorerModelVersion } = body;

    if (!ratingId || !freeTextReason) {
      return NextResponse.json(
        { success: false, error: "Validation error: free_text_reason is mandatory [P-12]" },
        { status: 400 }
      );
    }

    const feedback = await recordScoreFeedback({
      ratingId,
      actorRole: "learner",
      disagreementDirection: disagreementDirection || "too_low",
      freeTextReason,
      citedEvidenceRef: citedEvidenceRef || null,
      scorerModelVersion: scorerModelVersion || "claude-opus-5/extract-v1/score-v1",
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedback.feedback_id,
      recordedAt: feedback.created_at,
    });
  } catch (error: any) {
    console.error("Score feedback error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record score feedback" },
      { status: 500 }
    );
  }
}
