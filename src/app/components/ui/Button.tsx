import React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "quiet";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "border-accent bg-accent text-white hover:bg-accent-hover",
  secondary: "border-line-strong bg-surface text-ink hover:bg-surface-sunken",
  quiet: "border-transparent bg-transparent text-accent hover:bg-accent-wash",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

/**
 * 操作の起点。
 *
 * グラデーションと色付きの影は使わない。主たる操作は 1 画面に 1 つだけ `primary` にし、
 * 残りは `secondary` か `quiet` に落とす。
 */
export function Button({ variant = "secondary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-chip border px-cell py-1.5 text-label",
        // 押下にその場で応える。`transition: all` は使わず対象を並べる
        "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        VARIANT_CLASS[variant],
        className,
      )}
    />
  );
}
