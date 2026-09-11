import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
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
  } catch (error: unknown) {
    return apiErrorResponse("Session start error", error, "Failed to start session");
  }
}
