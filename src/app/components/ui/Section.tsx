import React from "react";
import { cn } from "./cn";

/**
 * 画面の区画（装飾の第 1 階層）。
 *
 * **枠を持たない。**区画の境目は見出しと余白で示す——ここに罫線を引くと、内側の枠と
 * 二重になって「枠の中の枠」が始まり、階層がかえって読めなくなる（`[D-102]`）。
 */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** 見出し行の右端に置く操作（ボタン、タブ、フィルタ） */
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-block", className)}>
      {(title || actions) && (
        <header className="flex flex-col justify-between gap-row sm:flex-row sm:items-end">
          <div className="space-y-1">
            {title && <h2 className="text-title text-ink">{title}</h2>}
            {description && <p className="max-w-3xl text-caption text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-row">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
