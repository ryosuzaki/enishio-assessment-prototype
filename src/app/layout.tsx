import type { Metadata, Viewport } from "next";
import { sansJp, mono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enishio Assessment Engine - 評価的判断力・動的アセスメント",
  description: "生成AI協働プロセス解析による「評価的判断力」動的アセスメント＆リスキリングプラットフォーム",
};

/** モバイルのブラウザ UI をページの地色へ揃える（Web Interface Guidelines） */
export const viewport: Viewport = {
  themeColor: "#f8f9fb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${sansJp.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-surface-page text-ink antialiased" suppressHydrationWarning>
        {/* 高さは h-12 で固定する。実務演習の作業領域はこの高さを引いた残りに収める（AssessmentWorkbench） */}
        <header className="sticky top-0 z-50 h-12 border-b border-line bg-surface">
          <div className="mx-auto flex h-full max-w-[1536px] items-center justify-between gap-block px-6">
            <div className="flex items-baseline gap-2.5">
              <span className="flex h-5 w-5 translate-y-0.5 items-center justify-center rounded-chip bg-accent text-label font-semibold text-white">
                E
              </span>
              <span className="text-section text-ink">Enishio Assessment</span>
              <span className="text-label text-ink-3">Prototype v0.1</span>
            </div>

            {/* 凡例。タブ側の「モック」表示と対になる——どこまでが実稼働かを最初に読ませる */}
            <div className="hidden items-center gap-block text-label text-ink-2 sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden />
                実稼働（実LLM・実DB）
              </span>
              <span className="flex items-center gap-1.5 border-l border-line pl-block text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full border border-ink-3" aria-hidden />
                モック（静的データ）
              </span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
