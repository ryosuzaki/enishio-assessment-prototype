import { NextResponse } from "next/server";
import { generateLearnerId, startSession } from "@/lib/telemetry";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantNamespace = body.tenantNamespace || "enishio-default-tenant";
    const rawUserId = body.userId || "founder-test-01";

    const learnerId = generateLearnerId(tenantNamespace, rawUserId);
    const session = await startSession(learnerId);

    return NextResponse.json({
      success: true,
      learnerId,
      sessionId: session.session_id,
      sessionSeq: session.session_seq,
      startedAt: session.started_at,
    });
  } catch (error: any) {
    console.error("Session start error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start session" },
      { status: 500 }
    );
  }
}
