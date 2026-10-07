import type { PremiseShift } from "@/data/dynamic-task";

/**
 * 前提変化（場面3: 緊急仕様変更・追加要件）の通知。
 *
 * 受講者が検証を提出した時点で、進行役が出す `[D-135]`。出すタイミングを発話回数のような
 * 代用指標で自動判定すると、検証の途中の受講者に撃ってしまい、学ぶ機会と評価する機会を奪う
 * （`[D-100]` が置いた発話2回の自動発火は、`[D-135]` で取り下げた）。
 * 通知の本文は課題ごとに固定した文で、LLM は関与しない。
 */

/** 前提変化のターンに付ける model_version。既存の `system-interlock` と同じ扱い。 */
export const PREMISE_SHIFT_MODEL_VERSION = "system-premise-shift";

/** 受講者の画面と対話ログに出る通知文。UI と DB で同一の本文を使う。 */
export function buildPremiseShiftNotification(shift: PremiseShift): string {
  return (
    `【⚡ 緊急仕様変更・追加要件の通知】\n${shift.announcement}\n\n` +
    // 通知は進行役の発言であり、受講者に次の行動を促す一文は付けない。促すと、不意の変化に
    // 自分から方針を組み直すかどうか（領域4）を測れなくなる。
    `これに伴い、以下の追加要件を満たす必要があります：\n「${shift.new_requirement}」`
  );
}
