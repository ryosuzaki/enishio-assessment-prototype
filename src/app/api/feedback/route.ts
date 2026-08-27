import { NextResponse } from "next/server";
import {
  recordScoreFeedback,
  resolveSessionContext,
  DISAGREEMENT_DIRECTIONS,
  type DisagreementDirection,
} from "@/lib/telemetry";

// POST /api/feedback - record learner score dispute or feedback [MVP 4.5]
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ratingId, sessionId, disagreementDirection, freeTextReason, citedEvidenceRef, scorerModelVersion } =
      body;

    if (!ratingId || !sessionId) {
      return NextResponse.json(
        { success: false, error: "ratingId and sessionId are required" },
        { status: 400 }
      );
    }
    if (!freeTextReason || !String(freeTextReason).trim()) {
      return NextResponse.json(
        { success: false, error: "Validation error: free_text_reason is mandatory [P-12]" },
        { status: 400 }
      );
    }
    // 4択は MVP 4.5 の定義。既定値で握りつぶすと、最も価値の高い
    // evidence_wrong（第1段階の根拠抽出が壊れている合図）を取り逃がす。
    if (!DISAGREEMENT_DIRECTIONS.includes(disagreementDirection)) {
      return NextResponse.json(
        {
          success: false,
          error: `disagreement_direction must be one of ${DISAGREEMENT_DIRECTIONS.join(" / ")} [MVP 4.5]`,
        },
        { status: 400 }
      );
    }
    await resolveSessionContext(sessionId);

    const feedback = await recordScoreFeedback({
      ratingId,
      sessionId,
      actorRole: "learner",
      disagreementDirection: disagreementDirection as DisagreementDirection,
      freeTextReason,
      citedEvidenceRef: citedEvidenceRef || null,
      scorerModelVersion: scorerModelVersion || "unknown",
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
