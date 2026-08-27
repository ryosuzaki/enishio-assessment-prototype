import { NextResponse } from "next/server";
import { recordVerificationFocusSequence, resolveSessionContext } from "@/lib/telemetry";

/**
 * POST /api/dialogue/focus
 *
 * Verification Focus Sequence [MVP 4.4, T-17b]
 * 受講者が成果物のどの箇所を検証対象として選択したかとその順序（focus_seq）を記録する。
 * ※ 採点器へは渡さず、Stage 1 以降のプロセス分析資産として保存する。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, focusItems } = body;

    if (!sessionId || !Array.isArray(focusItems)) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId or focusItems array" },
        { status: 400 }
      );
    }

    await resolveSessionContext(sessionId);

    const count = await recordVerificationFocusSequence(sessionId, focusItems);

    return NextResponse.json({
      success: true,
      recordedCount: count,
    });
  } catch (error: any) {
    console.error("Verification focus sequence recording error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record verification focus sequence" },
      { status: 500 }
    );
  }
}
