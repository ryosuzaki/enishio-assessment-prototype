import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { parseRequestBody } from "@/lib/request-validation";
import { recordPromptTurn, resolveSessionContext } from "@/lib/telemetry";
import { getDynamicTask } from "@/data/dynamic-task";
import { prisma } from "@/lib/db";
import {
  PREMISE_SHIFT_MODEL_VERSION,
  buildPremiseShiftNotification,
  decidePremiseShift,
} from "@/lib/premise-shift";

/**
 * POST /api/dialogue/premise-shift — 前提変化（場面3: 緊急仕様変更・追加要件）を撃つか判定する。
 *
 * **受講者は撃つ時点を選べない** `[D-100]`。判定の入力はサーバ側の対話ログだけで、
 * クライアントから渡るのは「どのセッションの何ターン目か」に限る。かつては受講者の画面に
 * 「⚡ 緊急仕様変更を発生させる」ボタンがあったが、身構えた状態での方針更新は不意の前提変化への
 * 適応ではなく、押さない自由がある限り領域4の証拠被覆率が受講者ごとに変わってしまう。
 *
 * **LLM を呼ばない。** 進行役の深掘り（/api/dialogue/probe）と違い、ここは決定論的に判定する。
 * モデルの可用性に左右されると、前提変化が撃たれたセッションと撃たれなかったセッションが
 * 外的要因で混在する。
 */
const PremiseShiftRequestSchema = z.object({
  sessionId: z.string().min(1),
  taskId: z.string().min(1),
  turnSeq: z.coerce.number().int().min(0),
  /** 開発時のみ有効な手動発火。本番ビルドでは無視する（下の判定を参照） */
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = await parseRequestBody(req, PremiseShiftRequestSchema, "Premise shift");
    if (!parsed.ok) return parsed.response;
    const { sessionId, taskId, turnSeq, force } = parsed.data;

    await resolveSessionContext(sessionId);
    // taskId が未知のIDなら getDynamicTask が投げる（黙って別課題にすり替えない）
    const task = getDynamicTask(taskId);
    const shift = task.premise_shift;

    // 手動発火は開発ビルド限定。**本番で効かせてはならない** —— 効くなら
    // 「受講者が撃てない」という設計上の保証が運用でいつでも破れることになる。
    const forceAllowed = force === true && process.env.NODE_ENV !== "production";

    // 判定材料はサーバ側の記録から読む（クライアントの申告を信用しない）
    const priorTurns = await prisma.promptTurn.findMany({
      where: { session_id: sessionId },
      select: { role: true, model_version: true },
    });
    const userTurnCount = priorTurns.filter((t) => t.role === "user").length;
    const alreadyInjected = priorTurns.some(
      (t) => t.model_version === PREMISE_SHIFT_MODEL_VERSION
    );

    const decision = decidePremiseShift({
      hasPremiseShift: !!shift,
      alreadyInjected,
      userTurnCount,
      triggerAfterUserTurns: shift?.trigger_after_user_turns,
    });

    // force でも「課題に前提変化が無い」「すでに撃った」は覆せない。
    // 覆すと二重注入で turn_seq が衝突する。
    const injecting =
      decision.inject || (forceAllowed && !!shift && !alreadyInjected);

    if (!injecting || !shift) {
      return NextResponse.json({
        success: true,
        injected: false,
        reason: decision.inject ? "already_injected" : decision.reason,
        userTurnCount,
      });
    }

    const notification = buildPremiseShiftNotification(shift);

    // 対話ログに残す。**残さないと AI同僚が緊急要件を知らないまま応答する** ——
    // /api/dialogue/turn は記録済みログから文脈を組み立てるため、画面にだけ出した通知は
    // AI同僚にも事後の監査にも届かない。
    await recordPromptTurn(
      sessionId,
      turnSeq,
      "assistant",
      notification,
      PREMISE_SHIFT_MODEL_VERSION
    );

    return NextResponse.json({
      success: true,
      injected: true,
      injectedAtTurn: turnSeq,
      forced: !decision.inject,
      shiftId: shift.id,
      title: shift.title,
      announcement: shift.announcement,
      newRequirement: shift.new_requirement,
      notification,
      userTurnCount,
    });
  } catch (error: unknown) {
    return apiErrorResponse("Premise shift error", error, "Premise shift failed");
  }
}
