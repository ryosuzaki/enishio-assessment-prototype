import React from "react";
import { cn } from "./cn";

interface CardProps {
  /** 枠の見出し。省くと枠だけの器になる */
  title?: React.ReactNode;
  /** 見出し行の右端に置く補足（出典・ステータス・版数など） */
  meta?: React.ReactNode;
  /** 見出しの下に置く短い説明 */
  description?: React.ReactNode;
  /**
   * 装飾の予算（`[D-102]`）。
   *
   * - `panel`: 枠を持つ第 2 階層。**データのまとまり 1 つにつき 1 枚**
   * - `inset`: 地色だけの第 3 階層。枠の中で塊を示すときに使う（罫線は引かない）
   * - `bare`: 枠も地色も持たない。見出しと余白だけで区切る
   *
   * **入れ子は panel → inset の 2 段まで。**3 段目が要るなら情報の切り方が間違っている。
   */
  variant?: "panel" | "inset" | "bare";
  className?: string;
  children: React.ReactNode;
}

/**
 * 情報のまとまりを示す枠。
 *
 * 影は使わない——階層は罫線と地色の 1 段差だけで表す。影で浮かせると画面上のすべてが
 * 等しく「重要」に見えてしまい、かえって読む順序が消える。
 */
export function Card({ title, meta, description, variant = "panel", className, children }: CardProps) {
  const isBare = variant === "bare";
  return (
    <section
      className={cn(
        !isBare && "rounded-card",
        variant === "panel" && "border border-line bg-surface",
        variant === "inset" && "bg-surface-sunken",
        className,
      )}
    >
      {(title || meta || description) && (
        <header
          className={cn(
            "flex flex-wrap items-baseline justify-between gap-x-block gap-y-1",
            !isBare && "px-pad pt-cell pb-cell",
            variant === "panel" && "border-b border-line",
          )}
        >
          {title && <h3 className="text-section text-ink">{title}</h3>}
          {meta && <div className="text-label text-ink-3">{meta}</div>}
          {description && <p className="w-full text-caption text-ink-2">{description}</p>}
        </header>
      )}
      <div className={cn(!isBare && "px-pad py-block")}>{children}</div>
    </section>
  );
}
