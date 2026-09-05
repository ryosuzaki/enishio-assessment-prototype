"use client";

import React from "react";
import {
  UserCheck,
  Award,
  Calendar,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Flame,
  BookOpen,
  History,
  Sparkles,
  Target,
  FileCode,
  ShieldCheck,
} from "lucide-react";

interface LearnerProfileProps {
  onStartSession: (taskId?: string) => void;
}

export function LearnerProfile({ onStartSession }: LearnerProfileProps) {
  // Radar chart calculations for 4 axes (angles: 0, 90, 180, 270 deg)
  // Center is (100, 100), max radius is 70
  // Values are 0 to 5.
  // Axis 0 (Top): 評価的判断力 (score: 3.8 / 5.0) -> y = 100 - (3.8/5)*70 = 100 - 53.2 = 46.8
  // Axis 1 (Right): 高次認知 (score: 3.4 / 5.0) -> x = 100 + (3.4/5)*70 = 100 + 47.6 = 147.6
  // Axis 2 (Bottom): 対話共創 (score: 3.2 / 5.0) -> y = 100 + (3.2/5)*70 = 100 + 44.8 = 144.8
  // Axis 3 (Left): 適応力 (score: 3.6 / 5.0) -> x = 100 - (3.6/5)*70 = 100 - 50.4 = 49.6

  const radarPoints = "100,46.8 147.6,100 100,144.8 49.6,100";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Meta Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <UserCheck className="w-4 h-4" />
            <span>受講者マイページ・スキルカルテ（B2B SaaS 構想モックUI）</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
              Viability
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            佐藤 拓也 さんのスキルカルテ＆検証行動分析
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
            単なる合否のテストではなく、日々の開発業務で生成AIと協働する際の「評価的判断力・検証行動」の現在地と成長の軌跡です。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>最終演習: 2026/09/01（残り5日で次回推奨）</span>
          </div>
          <button
            onClick={() => onStartSession()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <span>実務演習を開始</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20 shrink-0">
            ST
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">佐藤 拓也</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                決済基盤チーム / シニアエンジニア
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                IRT尺度 較正済み（共通アンカー4問受検済）
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-300 font-medium">
                <Flame className="w-3.5 h-3.5" />
                4週連続 受検達成
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:border-l md:border-slate-800 md:pl-6">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-28">
            <span className="text-[11px] text-slate-400 block">総合到達度</span>
            <span className="text-lg font-bold text-blue-400 font-mono mt-0.5 block">
              Band 3
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-28">
            <span className="text-[11px] text-slate-400 block">累計演習セッション</span>
            <span className="text-lg font-bold text-white font-mono mt-0.5 block">
              6 回
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-28">
            <span className="text-[11px] text-slate-400 block">検証バイアス型</span>
            <span className="text-xs font-bold text-emerald-400 mt-1 block">
              自律批判型
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Radar Chart & 4-Competency Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart (1 Col) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 flex flex-col items-center justify-between">
          <div className="w-full">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                4領域 動的コンピテンシー
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              AI協働下における動的アセスメントの4大測定ドメイン
            </p>
          </div>

          {/* SVG Radar */}
          <div className="relative w-56 h-56 my-2">
            <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
              {/* Concentric Grid Circles / Polygons */}
              {[14, 28, 42, 56, 70].map((r, i) => (
                <polygon
                  key={i}
                  points={`100,${100 - r} ${100 + r},100 100,${100 + r} ${100 - r},100`}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              ))}

              {/* Axes Lines */}
              <line x1="100" y1="30" x2="100" y2="170" stroke="#334155" strokeWidth="1" />
              <line x1="30" y1="100" x2="170" y2="100" stroke="#334155" strokeWidth="1" />

              {/* Data Polygon */}
              <polygon
                points={radarPoints}
                fill="rgba(99, 102, 241, 0.25)"
                stroke="#818cf8"
                strokeWidth="2.5"
              />

              {/* Data Points */}
              <circle cx="100" cy="46.8" r="4" fill="#38bdf8" />
              <circle cx="147.6" cy="100" r="4" fill="#818cf8" />
              <circle cx="100" cy="144.8" r="4" fill="#a855f7" />
              <circle cx="49.6" cy="100" r="4" fill="#34d399" />

              {/* Labels */}
              <text x="100" y="18" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                評価的判断力 (3.8)
              </text>
              <text x="180" y="103" textAnchor="start" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                高次認知 (3.4)
              </text>
              <text x="100" y="188" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                対話共創 (3.2)
              </text>
              <text x="20" y="103" textAnchor="end" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                適応力 (3.6)
              </text>
            </svg>
          </div>

          <div className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 text-center">
            4領域すべてで <strong className="text-white">Band 3 (自律的検証水準)</strong> をクリア。
            「評価的判断力」が最も優れています。
          </div>
        </div>

        {/* Competencies Breakdown (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              領域別 到達度と行動エビデンス
            </h2>
          </div>

          <div className="space-y-3">
            {/* Domain 1 */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-xs font-bold text-white">
                    ① 評価的判断力（Epistemic Judgement）
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-blue-400">
                  Level 3.8 / 5.0
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                AIが生成したコードの前提（単一障害点、PCI DSS、冪等性制約）を自律的に見抜き、具体的な修正を要求できています。正常コードの誤判定がごく稀にあるため、システム全体のトレードオフ意識が次の鍵です。
              </p>
            </div>

            {/* Domain 2 */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  <span className="text-xs font-bold text-white">
                    ② 高次認知・自己客観化（Metacognitive Judgement）
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  Level 3.4 / 5.0
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                CFF（認知強制機能）での事前暫定判断において、自身の確信度と実際の検出精度が高い整合性を示しています。理由記述（Mandatory Justification）の言語化も具体的です。
              </p>
            </div>

            {/* Domain 3 */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-xs font-bold text-white">
                    ③ 対話共創・ソクラテス的探究（Co-creation Dialogue）
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400">
                  Level 3.2 / 5.0
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                AI同僚とのやり取りで、単なる指示出しにとどまらず「なぜそのパラメータにしたか」の根拠を問いただす（Trace Grounding）行動が確認されています。
              </p>
            </div>

            {/* Domain 4 */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    ④ 適応力・What-if耐性（Context Adaptation）
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Level 3.6 / 5.0
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                メディエーターによる「もしトラフィックが100倍になったら？」等の前提変更（What-if）の揺さぶりに対し、矛盾のない論理で設計修正を適応させています。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bias Diagnosis & Reliance Metrics */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                検証行動バイアス診断（適正依存3指標）
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              AI生成物に対する「過剰依存（鵜呑み）」と「不足依存（不当な拒絶）」のバランスを定量化
            </p>
          </div>

          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold self-start sm:self-auto">
            判定: 自律批判型（Autonomous Critical）
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Metric 1 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">正当AI依存率 (CAR)</span>
              <span className="font-mono text-blue-400 font-bold">82%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full w-[82%]" />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              AIが正しい提案をした際、不必要に書き換えずに受容できた割合。
            </p>
          </div>

          {/* Metric 2 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">正当自己依存率 (CSR)</span>
              <span className="font-mono text-emerald-400 font-bold">76%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-[76%]" />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              AIの提案に不備があった際、自力で見抜いて修正指示を出せた割合。
            </p>
          </div>

          {/* Metric 3 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">自動化バイアス指数 (ABI)</span>
              <span className="font-mono text-emerald-400 font-bold">0.12 (極小)</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-[12%]" />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              AIの誤りを鵜呑みにする盲従リスク。0.30以下が極めて安全な水準。
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-xs text-slate-300 leading-relaxed">
          <strong className="text-blue-300 block mb-1">🔍 育成アドバイザリー</strong>
          佐藤さんはAIの出力を無批判に受け入れる傾向（自動化バイアス）がほとんど無く、非機能制約を厳密に検証できています。一方で、AIが意図的に正当な構造で書いたキャッシュ参照ロジックに対し「もっと別の設計があるのでは」と過剰に指摘する傾向が僅かに見られます。次回は「正常箇所の弁別」を意識すると、実務での手戻りがさらに削減されます。
        </div>
      </div>

      {/* Past Sessions History & Next Recommendation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Past Sessions (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                過去セッション演習履歴
              </h2>
            </div>
            <span className="text-xs text-slate-400">直近4回を表示</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase">
                  <th className="py-2.5 px-3">受検日時</th>
                  <th className="py-2.5 px-3">演習課題</th>
                  <th className="py-2.5 px-3 text-center">判定Band</th>
                  <th className="py-2.5 px-3 text-center">編集距離</th>
                  <th className="py-2.5 px-3 text-center">検出根拠</th>
                  <th className="py-2.5 px-3 text-right">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 text-slate-400 font-mono">2026/09/01</td>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    [T-06a] 決済トランザクションの冪等性・障害時キャッシュ
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                      Band 3
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">142</td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-semibold">3件特定</td>
                  <td className="py-3 px-3 text-right text-slate-400">完了</td>
                </tr>

                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 text-slate-400 font-mono">2026/08/24</td>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    [T-06b] 高トラフィック通知配信基盤のRate Limit整合性
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Band 4
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">89</td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-semibold">4件特定</td>
                  <td className="py-3 px-3 text-right text-slate-400">完了</td>
                </tr>

                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 text-slate-400 font-mono">2026/08/17</td>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    [T-06c] イベント駆動アーキテクチャのデッドレター検証
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                      Band 3
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">210</td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-semibold">2件特定</td>
                  <td className="py-3 px-3 text-right text-slate-400">完了</td>
                </tr>

                <tr className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 text-slate-400 font-mono">2026/08/10</td>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    [T-05] 認証トークン失効とPCI DSS監査ログ要件
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                      Band 3
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">165</td>
                  <td className="py-3 px-3 text-center text-emerald-400 font-semibold">3件特定</td>
                  <td className="py-3 px-3 text-right text-slate-400">完了</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommended Next Scenario Card (1 Col) */}
        <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900/90 to-indigo-950/40 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>次回レコメンド演習課題</span>
            </div>
            <h3 className="text-base font-bold text-white">
              非同期メッセージキューの順序保証とリトライ嵐（Thundering Herd）検証
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              直近のセッションで高評価だった例外系フォールバック力を活かし、より複雑な「前提変更（負荷急増時）への適応力」をBand 4へ引き上げるための演習です。
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                ドメイン: 分散システム
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                強化目標: 適応力 Band 4
              </span>
            </div>
          </div>

          <button
            onClick={() => onStartSession("TASK-RETRY-STORM-01")}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 transition-all"
          >
            <span>この推奨演習を開始する</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
