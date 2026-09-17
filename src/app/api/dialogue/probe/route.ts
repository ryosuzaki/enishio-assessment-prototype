import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  selectProbe,
  MediationUnavailableError,
  MEDIATOR_MODEL_VERSION,
  MAX_PROBES_PER_SESSION,
  type ProbeMove,
} from "@/lib/mediator";
import {
  recordMediationProbe,
  recordPromptTurn,
  recordLlmCall,
  resolveSessionContext,
} from "@/lib/telemetry";
import { getDynamicTask } from "@/data/dynamic-task";
import { prisma } from "@/lib/db";

/**
 * POST /api/dialogue/probe — ソクラテス型深掘り・What-if注入を1手打つ（MVP 2.1 ステップ7・8）。
 *
 * AI同僚の応答（/api/dialogue/turn）とは**別の手番**である。AI同僚は成果物を書く相手であり、
 * メディエーターは受講者の判断を引き出す相手である。役割を混ぜると、受講者が検証したのか
 * メディエーターが教えたのかがログ上で分離できなくなる。
 *
 * **正答鍵（injected_flaw_map）はこのルートを通らない。** 選択器へ渡すのは、受講者の画面に
 * すでに出ている業務要件・制約と、対話ログだけである `[D-28]`。
 */
export async function POST(req: Request) {
  try {
    const { sessionId, taskId, turnSeq } = await req.json();

    if (!sessionId || !taskId || typeof turnSeq !== "number") {
      return NextResponse.json(
        { success: false, error: "Missing required parameters (sessionId / taskId / turnSeq)" },
        { status: 400 }
      );
    }

    await resolveSessionContext(sessionId);
    // taskId が未知のIDなら getDynamicTask が投げる（黙って別課題にすり替えない）
    const task = getDynamicTask(taskId);

    // これまでの手番はサーバ側のログから読む（クライアントの申告を信用しない）
    const priorProbes = await prisma.mediationProbe.findMany({
      where: { session_id: sessionId },
      orderBy: { turn_seq: "asc" },
      select: { probe_move: true },
    });
    const probesSoFar = priorProbes
      .map((p) => p.probe_move as ProbeMove)
      .filter((m) => m !== "none");

    if (probesSoFar.length >= MAX_PROBES_PER_SESSION) {
      // MVP 2.1 ステップ7は「3〜4ターン」。上限に達したら打ち切る。
      return NextResponse.json({
        success: true,
        probeIssued: false,
        reason: "max_probes_reached",
        probesSoFar: probesSoFar.length,
      });
    }

    const priorTurns = await prisma.promptTurn.findMany({
      where: { session_id: sessionId },
      orderBy: { turn_seq: "asc" },
      select: { turn_seq: true, role: true, content: true },
    });

    const selection = await selectProbe({
      transcript: priorTurns.map((t) => ({
        turnSeq: t.turn_seq,
        role: t.role,
        content: t.content,
      })),
      businessRequirements: task.business_requirements,
      constraints: task.constraints,
      contextDocuments: (task.context_documents ?? []).map((d) => ({
        title: d.title,
        type: d.type,
      })),
      probesSoFar,
      onUsage: (usage) => {
        // 記録の失敗で深掘りを止めない（recordLlmCall 側で握る）
        void recordLlmCall(sessionId, usage);
      },
    });

    // 状態推定は「問わない」と判断した場合も残す。**打たなかったことも媒介方針の一部であり、
    // 記録しなければ「なぜこのセッションでは深掘りが無いのか」が事後に分からなくなる。**
    await recordMediationProbe({
      sessionId,
      turnSeq,
      probeMove: selection.probe_move,
      probeText: selection.probe_text,
      stateEstimate: { targets: selection.state_estimate },
      selectionRationale: selection.selection_rationale,
      mediatorModelVersion: MEDIATOR_MODEL_VERSION,
    });

    if (selection.probe_move === "none" || !selection.probe_text.trim()) {
      return NextResponse.json({
        success: true,
        probeIssued: false,
        reason: "no_probe_needed",
        probeMove: selection.probe_move,
        stateEstimate: selection.state_estimate,
        selectionRationale: selection.selection_rationale,
        probesSoFar: probesSoFar.length,
      });
    }

    // 問いは対話ログにも残す。受講者が何に答えたのかが分からないと、
    // 第1エージェントが応答の一貫性を判定できない。
    await recordPromptTurn(sessionId, turnSeq, "mediator", selection.probe_text, MEDIATOR_MODEL_VERSION);

    return NextResponse.json({
      success: true,
      probeIssued: true,
      probeMove: selection.probe_move,
      probeText: selection.probe_text,
      stateEstimate: selection.state_estimate,
      selectionRationale: selection.selection_rationale,
      mediatorModelVersion: MEDIATOR_MODEL_VERSION,
      probeTurnSeq: turnSeq,
      probesSoFar: probesSoFar.length + 1,
    });
  } catch (error: unknown) {
    if (error instanceof MediationUnavailableError) {
      // 深掘りできないときに定型文で埋めない。埋めると mediation_probes に
      // 「モデルが選んだ手」ではないログが残り、媒介方針の追跡可能性が崩れる。
      return apiErrorResponse("Mediation unavailable", error, "Probe selection failed", {
        status: 503,
        extra: { mediationUnavailable: true },
      });
    }
    return apiErrorResponse("Probe selection error", error, "Probe selection failed");
  }
}
