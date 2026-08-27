import { NextResponse } from "next/server";
import { recordInjectedFlawMap, resolveSessionContext } from "@/lib/telemetry";
import { getInjectedFlaws } from "@/data/dynamic-task.server";
import { getDynamicTask } from "@/data/dynamic-task";

/**
 * POST /api/dialogue/start
 *
 * 動的課題の開始時に injected_flaw_map を確定させる（W3 完了条件・MVP 4.4）。
 * **正常箇所（is_flaw = false）も同じ表へ書く。**これが無いと、受講者の指摘が
 * 正しい摘発なのか過剰指摘なのかを後から判定できない [P-15]。
 *
 * レスポンスに仕込み内容そのものは返さない（クライアントは受検者の画面である）。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, taskId } = body;

    if (!sessionId || !taskId) {
      return NextResponse.json({ success: false, error: "Missing sessionId or taskId" }, { status: 400 });
    }

    // taskId が未知のIDなら getDynamicTask が投げる（黙って別課題にすり替えない）
    const task = getDynamicTask(taskId);
    const injectedFlaws = getInjectedFlaws(taskId);

    await resolveSessionContext(sessionId);

    const recorded = await recordInjectedFlawMap(
      sessionId,
      injectedFlaws.map((f) => ({
        flaw_id: f.flaw_id,
        flaw_type: f.flaw_type,
        span_text: f.span_text,
        is_flaw: f.is_flaw,
        description: f.description,
      }))
    );

    return NextResponse.json({
      success: true,
      taskId: task.task_id,
      recordedSpanCount: recorded,
      flawCount: injectedFlaws.filter((f) => f.is_flaw).length,
      normalSpanCount: injectedFlaws.filter((f) => !f.is_flaw).length,
    });
  } catch (error: any) {
    console.error("Dialogue start error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start dynamic task" },
      { status: 500 }
    );
  }
}
