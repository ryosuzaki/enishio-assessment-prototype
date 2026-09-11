import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { accumulateWindowBlurDuration, resolveSessionContext } from "@/lib/telemetry";

/**
 * POST /api/session/blur — 画面外滞在時間を加算する（MVP 4.4 `window_blur_duration_sec`）。
 *
 * **判定には一切用いず記録のみである。**Phase 3 の多層防衛の資産として貯めるだけであり、
 * 採点・保留判定・XAIレポートのどこからも参照してはならない。受講者へも提示しない。
 */
export async function POST(req: Request) {
  try {
    const { sessionId, deltaSec } = await req.json();

    if (!sessionId || typeof deltaSec !== "number" || !Number.isFinite(deltaSec)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid sessionId / deltaSec" },
        { status: 400 }
      );
    }

    // 極端な値はクライアント時計のずれ・スリープ復帰によるものとして捨てる。
    // 判定に使わない記録なので、無理に救わない。
    if (deltaSec <= 0 || deltaSec > 60 * 60 * 4) {
      return NextResponse.json({ success: true, recorded: false });
    }

    await resolveSessionContext(sessionId);
    await accumulateWindowBlurDuration(sessionId, deltaSec);

    return NextResponse.json({ success: true, recorded: true });
  } catch (error: unknown) {
    // 記録専用の副次的なテレメトリである。失敗してもセッションは続行させる。
    return apiErrorResponse("Window blur telemetry error", error, "Failed to record blur duration");
  }
}
