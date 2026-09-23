import type { PremiseShift } from "@/data/dynamic-task";

/**
 * 前提変化（場面3: 緊急仕様変更・追加要件）の注入タイミングを決める。
 *
 * **受講者は発火タイミングを選べない。** 自分で撃てるなら、身構えた状態での方針更新に
 * なり、測っているものが「不意の前提変化への適応」ではなくなる。押さない自由があれば
 * 領域4（メタ認知・適応力）の証拠が取れたセッションと取れないセッションが混在し、
 * 等化以前に比較対象が揃わない `[D-100]`。
 *
 * **LLM には委ねない。** 進行役の深掘り（`src/lib/mediator`）はモデルが手を選ぶが、
 * 前提変化まで生成側の裁量にすると注入時点が受講者間でばらつき、それ自体が
 * 比較不能な自由度になる。ここは対話ログから決まる決定論的な条件で撃つ。
 */

/** 前提変化のターンに付ける model_version。既存の `system-interlock` と同じ扱い。 */
export const PREMISE_SHIFT_MODEL_VERSION = "system-premise-shift";

/**
 * 既定の発火条件：受講者の発話が2回に達した直後。
 *
 * 1回目で初期方針を表明し、2回目でその方針に沿って追撃した時点を「初期方針が確定した」
 * とみなす。ここより早いと固執する対象がまだ存在せず、遅いとレビューが終わってしまう。
 */
export const PREMISE_SHIFT_DEFAULT_TRIGGER_USER_TURNS = 2;

export type PremiseShiftSkipReason =
  | "no_premise_shift_defined"
  | "already_injected"
  | "trigger_turn_not_reached";

export type PremiseShiftDecision =
  | { inject: true }
  | { inject: false; reason: PremiseShiftSkipReason };

export function decidePremiseShift(params: {
  /** 課題に前提変化が定義されているか */
  hasPremiseShift: boolean;
  /** このセッションで注入済みか（サーバ側ログから判定する） */
  alreadyInjected: boolean;
  /** これまでにログへ記録された受講者の発話回数 */
  userTurnCount: number;
  /** 課題ごとの発火しきい値。未指定なら既定値 */
  triggerAfterUserTurns?: number;
}): PremiseShiftDecision {
  if (!params.hasPremiseShift) return { inject: false, reason: "no_premise_shift_defined" };
  if (params.alreadyInjected) return { inject: false, reason: "already_injected" };

  const threshold = params.triggerAfterUserTurns ?? PREMISE_SHIFT_DEFAULT_TRIGGER_USER_TURNS;
  if (params.userTurnCount < threshold) {
    return { inject: false, reason: "trigger_turn_not_reached" };
  }
  return { inject: true };
}

/** 受講者の画面と対話ログに出る通知文。UI と DB で同一の本文を使う。 */
export function buildPremiseShiftNotification(shift: PremiseShift): string {
  return (
    `【⚡ 緊急仕様変更・追加要件の通知】\n${shift.announcement}\n\n` +
    `これに伴い、以下の追加要件を満たす必要があります：\n「${shift.new_requirement}」\n\n` +
    `現在の設計やコードで問題がないか、確認と修正方針の指示をお願いします！`
  );
}
