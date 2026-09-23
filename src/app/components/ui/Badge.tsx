import React from "react";
import { cn } from "./cn";

type Tone = "neutral" | "accent" | "positive" | "caution" | "critical";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface-sunken text-ink-2",
  accent: "border-accent/25 bg-accent-wash text-accent",
  positive: "border-positive/25 bg-positive-wash text-positive",
  caution: "border-caution/25 bg-caution-wash text-caution",
  critical: "border-critical/25 bg-critical-wash text-critical",
};

/**
 * 短い状態表示。
 *
 * **意味色は状態にだけ使う。**種類を並べたいだけなら `neutral` を使い、区別は文字で付ける。
 * 4 領域に 4 色を割り当てるような色分けはしない。
 */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-chip border px-1.5 py-px text-label",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
