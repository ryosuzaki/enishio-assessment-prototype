import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enishio Assessment Engine - 評価的判断力・動的アセスメント",
  description: "生成AI協働プロセス解析による「評価的判断力」動的アセスメント＆リスキリングプラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen bg-[#090d16] text-slate-100 selection:bg-blue-600 selection:text-white"
        suppressHydrationWarning
      >
        <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                E
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Enishio Assessment
                </span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  Prototype v0.1
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Telemetry Active
              </span>
              <span className="font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Axis 4 (Epistemic & Ethical)
              </span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
