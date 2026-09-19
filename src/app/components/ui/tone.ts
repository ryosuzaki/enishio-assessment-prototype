/**
 * 数値の健全性を色へ写す（`[D-103]`）。
 *
 * **符号では判断できない。**「盲従バイアス克服率 -28.4 pt」は無検証承認率が減ったという
 * 良い変化であり、「過剰指摘率 +5 pt」は悪い変化である。指標ごとに良い向きを渡す。
 *
 * 閾値を跨いだものだけが色を持ち、**その間は無彩色で沈める**——全部に色が付けば、
 * どこを見るべきかという情報は消える。
 */
export type Tone = "positive" | "caution" | "critical" | "neutral";

export function thresholdTone(
  value: number,
  options: {
    /** これ以上（higherIsBetter=false ならこれ以下）で良好 */
    good: number;
    /** これ未満（同 これ超）で要注意 */
    poor: number;
    /** 既定は「高いほど良い」。低いほど良い指標では false を渡す */
    higherIsBetter?: boolean;
    /** 要注意を critical まで上げるか（既定は caution） */
    poorTone?: "caution" | "critical";
  },
): Tone {
  const { good, poor, higherIsBetter = true, poorTone = "caution" } = options;
  const ok = higherIsBetter ? value >= good : value <= good;
  const bad = higherIsBetter ? value < poor : value > poor;
  if (ok) return "positive";
  if (bad) return poorTone;
  return "neutral";
}

const TEXT_CLASS: Record<Tone, string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
  neutral: "text-ink-2",
};

/** `thresholdTone` の結果を文字色のクラスへ。 */
export function toneText(tone: Tone): string {
  return TEXT_CLASS[tone];
}

const CHIP_CLASS: Record<Tone, string> = {
  positive: "text-positive",
  caution: "rounded-chip bg-caution-wash px-1.5 text-caution",
  critical: "rounded-chip bg-critical-wash px-1.5 text-critical",
  neutral: "text-ink-2",
};

/**
 * 一覧の中の1つの値を目立たせる。
 *
 * **要注意の側にだけ面を敷く。**良好が多数派の一覧で良好に面を付けると画面が埋まり、
 * かえって何も目立たなくなる——文字色だけで足りる。手当てが要る値は数が少ないので、
 * 面を敷いて初めて走査で拾える。
 */
export function toneChip(tone: Tone): string {
  return CHIP_CLASS[tone];
}
