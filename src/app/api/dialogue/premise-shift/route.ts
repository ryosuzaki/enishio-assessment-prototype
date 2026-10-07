import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { parseRequestBody } from "@/lib/request-validation";
import { recordPromptTurn, resolveSessionContext } from "@/lib/telemetry";
import { getDynamicTask } from "@/data/dynamic-task";
import { prisma } from "@/lib/db";
import { PREMISE_SHIFT_MODEL_VERSION, buildPremiseShiftNotification } from "@/lib/premise-shift";

/**
 * POST /api/dialogue/premise-shift — 前提変化（場面3: 緊急仕様変更・追加要件）を出す。
 *
 * 受講者が検証を提出した（「検証を提出する」を押した）時点で、進行役が出す `[D-135]`。
 * 通知の本文は課題ごとに固定した文で、LLM は関与しない。出すタイミングは受講者の区切りに
 * 合わせる。発話回数のような代用指標で自動的に撃つと、検証の途中の受講者から、学ぶ機会と
 * 評価する機会を奪う。タイミングを判断する自動化は、必要になった時点で足す。
 *
 * 同じセッションで2回は出さない（出し済みなら `injected: false`）。出し済みかどうかは、
 * クライアントの申告ではなくサーバ側の対話ログから読む。
 */
const PremiseShiftRequestSchema = z.object({
  sessionId: z.string().min(1),
  taskId: z.string().min(1),
  turnSeq: z.coerce.number().int().min(0),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseRequestBody(req, PremiseShiftRequestSchema, "Premise shift");
    if (!parsed.ok) return parsed.response;
    const { sessionId, taskId, turnSeq } = parsed.data;

    await resolveSessionContext(sessionId);
    // taskId が未知のIDなら getDynamicTask が投げる（黙って別課題にすり替えない）
    const task = getDynamicTask(taskId);
    const shift = task.premise_shift;

    if (!shift) {
      return NextResponse.json({ success: true, injected: false, reason: "no_premise_shift_defined" });
    }

    const priorTurns = await prisma.promptTurn.findMany({
      where: { session_id: sessionId },
      select: { model_version: true },
    });
    if (priorTurns.some((t) => t.model_version === PREMISE_SHIFT_MODEL_VERSION)) {
      // 二重に出すと turn_seq が衝突し、通知が2回ログに残る
      return NextResponse.json({ success: true, injected: false, reason: "already_injected" });
    }

    const notification = buildPremiseShiftNotification(shift);

    // 対話ログに残す。**残さないと AIエージェントが緊急要件を知らないまま応答する** ——
    // /api/dialogue/turn は記録済みログから文脈を組み立てるため、画面にだけ出した通知は
    // AIエージェントにも事後の監査にも届かない。
    // 発言者は進行役（mediator）。AIエージェント（assistant）にすると、AIエージェントが
    // 自分で通知したことになり、採点側にも AIエージェントの発話として渡ってしまう。
    await recordPromptTurn(sessionId, turnSeq, "mediator", notification, PREMISE_SHIFT_MODEL_VERSION);

    return NextResponse.json({
      success: true,
      injected: true,
      injectedAtTurn: turnSeq,
      shiftId: shift.id,
      title: shift.title,
      announcement: shift.announcement,
      newRequirement: shift.new_requirement,
      notification,
    });
  } catch (error: unknown) {
    return apiErrorResponse("Premise shift error", error, "Premise shift failed");
  }
}
