import React from "react";
import { cn } from "./cn";

/**
 * 「項目名とその値」の 1 組。診断レポートの記述項目にあたる。
 *
 * 項目名は小さく淡く、値は本文サイズで置く——**大きさと濃さの差で階層を作り、色は使わない。**
 * 英大文字の見出し（`uppercase tracking-wider`）も使わない。
 */
export function Field({
  label,
  children,
  className,
  numeric = false,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** 数値を桁揃えで出すとき */
  numeric?: boolean;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <dt className="text-label text-ink-3">{label}</dt>
      <dd className="text-caption text-ink" {...(numeric ? { "data-numeric": "" } : {})}>
        {children}
      </dd>
    </div>
  );
}

/** `Field` を並べる器。既定は 1 列、`columns` で横に割る。 */
export function FieldGroup({
  columns = 1,
  className,
  children,
}: {
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}) {
  const COLUMN_CLASS: Record<number, string> = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
  };
  return (
    <dl className={cn("grid grid-cols-1 gap-x-block gap-y-row", COLUMN_CLASS[columns], className)}>
      {children}
    </dl>
  );
}
