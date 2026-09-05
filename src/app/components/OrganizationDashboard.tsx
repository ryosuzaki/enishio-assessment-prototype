"use client";

import React, { useState } from "react";
import {
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Activity,
  Zap,
  Layers,
  Sparkles,
  Filter,
  Info,
  ChevronRight,
  TrendingDown,
} from "lucide-react";

interface OrganizationDashboardProps {
  onStartSession: () => void;
}

interface TeamCompetency {
  name: string;
  memberCount: number;
  overallBand: number;
  scores: {
    epistemic: number; // 評価的判断力
    metacognition: number; // 高次認知
    dialogue: number; // 対話共創
    adaptation: number; // 適応力
  };
  riskType: "healthy" | "over_reliance" | "over_rejection";
  riskNote: string;
}

const TEAMS_DATA: TeamCompetency[] = [
  {
    name: "決済基盤チーム",
    memberCount: 24,
    overallBand: 3.8,
    scores: { epistemic: 4.1, metacognition: 3.8, dialogue: 3.5, adaptation: 3.9 },
    riskType: "healthy",
    riskNote: "PCI DSS制約や単一障害点（SPOF）への検証が組織的に定着。高次認知も安定。",
  },
  {
    name: "コアAPIプラットフォーム",
    memberCount: 38,
    overallBand: 3.5,
    scores: { epistemic: 3.6, metacognition: 3.4, dialogue: 3.6, adaptation: 3.3 },
    riskType: "healthy",
    riskNote: "キャッシュTTLやレートリミットの整合性検証が標準化。堅調に推移。",
  },
  {
    name: "モバイル・フロントエンドチーム",
    memberCount: 32,
    overallBand: 2.7,
    scores: { epistemic: 2.5, metacognition: 2.6, dialogue: 3.1, adaptation: 2.8 },
    riskType: "over_reliance",
    riskNote: "AI提案コードの編集距離が極小（5未満）。非同期例外やフォールバックの見落としリスクあり。",
  },
  {
    name: "データ分析基盤チーム",
    memberCount: 26,
    overallBand: 3.4,
    scores: { epistemic: 3.7, metacognition: 3.2, dialogue: 3.0, adaptation: 3.5 },
    riskType: "over_rejection",
    riskNote: "正常コードに対する不信（False Positive指摘）が28%発生。手戻り工数増加の要因に。",
  },
  {
    name: "SRE / インフラチーム",
    memberCount: 22,
    overallBand: 4.2,
    scores: { epistemic: 4.4, metacognition: 4.1, dialogue: 3.9, adaptation: 4.3 },
    riskType: "healthy",
    riskNote: "What-if前提変更に対する耐性が最上位水準。社内ベストプラクティスリーダー。",
  },
];

export function OrganizationDashboard({ onStartSession }: OrganizationDashboardProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [activeViewTeam, setActiveViewTeam] = useState<TeamCompetency>(TEAMS_DATA[0]);

  const filteredTeams =
    selectedTeam === "all"
      ? TEAMS_DATA
      : TEAMS_DATA.filter((t) => t.name === selectedTeam);

  const getBandBadgeClass = (score: number) => {
    if (score >= 4.0) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (score >= 3.0) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (score >= 2.5) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-rose-500/15 text-rose-400 border-rose-500/30";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Meta Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Building2 className="w-4 h-4" />
            <span>企業向け分析・管理ポータル（B2B SaaS 構想モックUI）</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">
              Viability
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            組織動的コンピテンシー・手戻りリスク分析
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
            AI協働開発における各開発チームの「評価的判断力・検証行動」を可視化し、
            AI盲従による不備流出リスクと、手戻り工数削減によるROIを定量的に把握します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>対象期間: 直近90日間</span>
          </div>
          <button
            onClick={onStartSession}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <span>実務演習を直接体験</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>受検完了エンジニア</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">142</span>
            <span className="text-xs text-slate-400">/ 161 名</span>
            <span className="ml-auto inline-flex items-center text-xs text-emerald-400 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              88.2%
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            受検完了率が前期比 +12% 向上。月次定期演習の受検習慣が定着。
          </p>
        </div>

        {/* Card 2 */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>組織平均 検証力スコア</span>
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400 tracking-tight">Band 3.4</span>
            <span className="text-xs text-slate-400">/ 5.0</span>
            <span className="ml-auto inline-flex items-center text-xs text-emerald-400 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +0.6 pt
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            「Band 3: 前提摘発・要件検証行動」水準に組織中央値が到達。
          </p>
        </div>

        {/* Card 3 */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-indigo-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>月間手戻り工数削減効果</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-400 tracking-tight">-240</span>
            <span className="text-xs text-slate-400">時間 / 月</span>
            <span className="ml-auto text-xs text-indigo-300 font-semibold">
              約 360万円/月 試算
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            PRレビューでの初期的不備差し戻し率が 34% 減少したことによる推計値。
          </p>
        </div>

        {/* Card 4 */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-amber-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>AI盲従リスク検知（要注視）</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400 tracking-tight">14.1%</span>
            <span className="text-xs text-slate-400">(20名)</span>
            <span className="ml-auto inline-flex items-center text-xs text-emerald-400 font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              -5.9% 改善
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            CFF事前判断における無検証即時承認率。重点フォロー対象部署を特定。
          </p>
        </div>
      </div>

      {/* Main Grid: Heatmap & Alert System */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap Section (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">
                  組織動的コンピテンシー 4領域ヒートマップ
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                チーム別の各コンピテンシー到達度（0〜5 Band）。行をクリックすると詳細カルテを確認できます。
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/80 mr-0.5" />
              <span>4.0+ (自律探究)</span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500/80 ml-2 mr-0.5" />
              <span>3.0+ (前提摘発)</span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/80 ml-2 mr-0.5" />
              <span>&lt;3.0 (要育成)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-3">対象チーム</th>
                  <th className="py-3 px-3 text-center">人数</th>
                  <th className="py-3 px-3 text-center">総合Band</th>
                  <th className="py-3 px-3 text-center">① 評価的判断力</th>
                  <th className="py-3 px-3 text-center">② 高次認知</th>
                  <th className="py-3 px-3 text-center">③ 対話共創</th>
                  <th className="py-3 px-3 text-center">④ 適応力</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTeams.map((team) => (
                  <tr
                    key={team.name}
                    onClick={() => setActiveViewTeam(team)}
                    className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${
                      activeViewTeam.name === team.name ? "bg-blue-900/20" : ""
                    }`}
                  >
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        {team.name}
                        {team.riskType === "over_reliance" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            盲従注視
                          </span>
                        )}
                        {team.riskType === "over_rejection" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            過剰指摘
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-xs">
                      {team.memberCount}名
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${getBandBadgeClass(
                          team.overallBand
                        )}`}
                      >
                        {team.overallBand.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-block w-14 py-1 rounded text-xs font-mono font-medium border ${getBandBadgeClass(
                          team.scores.epistemic
                        )}`}
                      >
                        {team.scores.epistemic.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-block w-14 py-1 rounded text-xs font-mono font-medium border ${getBandBadgeClass(
                          team.scores.metacognition
                        )}`}
                      >
                        {team.scores.metacognition.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-block w-14 py-1 rounded text-xs font-mono font-medium border ${getBandBadgeClass(
                          team.scores.dialogue
                        )}`}
                      >
                        {team.scores.dialogue.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-block w-14 py-1 rounded text-xs font-mono font-medium border ${getBandBadgeClass(
                          team.scores.adaptation
                        )}`}
                      >
                        {team.scores.adaptation.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected Team Detail Callout */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  選択中: {activeViewTeam.name}
                </span>
                <span className="text-xs text-slate-400">
                  （平均 Band {activeViewTeam.overallBand.toFixed(1)} / 所属 {activeViewTeam.memberCount}名）
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeViewTeam.riskNote}
              </p>
            </div>
          </div>
        </div>

        {/* Risk Alerts & Diagnostics Panel (1 Col) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                AI盲従・過剰指摘リスクアラート
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              セッション中の成果物編集距離、CFF事前承認時間、検証フォーカス選択率の異常値をリアルタイム検知。
            </p>

            {/* Alert Item 1: Over-Reliance */}
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  高リスク: AI盲従・無検証承認
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/50 text-amber-300">
                  発生率 38%
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-200">
                モバイル・フロントエンドチーム
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                AI生成コード提示時、成果物編集距離が5未満のまま承認するセッションが集中。単一障害点や例外系の見落としリスク大。
              </p>
              <div className="pt-1">
                <span className="text-[10px] text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  推奨施策: 動的課題 T-06b（キャッシュ整合性）を重点配信
                </span>
              </div>
            </div>

            {/* Alert Item 2: Over-Rejection */}
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  中リスク: 正常コードへの過剰指摘
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/50 text-rose-300">
                  発生率 28%
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-200">
                データ分析基盤チーム
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                AIが提示した正常な冪等性担保ロジックに対し、誤った指摘（False Positive）を出し対話が長期化する傾向。
              </p>
              <div className="pt-1">
                <span className="text-[10px] text-rose-300 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  推奨施策: 正常コード弁別アンカー（Family B）の復習を推奨
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-center">
            <span className="text-[11px] text-slate-400 block mb-2">
              ※本検知ロジックはテレメトリ基盤（InjectedFlawMap / RelianceMetrics）と直結
            </span>
          </div>
        </div>
      </div>

      {/* Handback Reduction Simulation & Benchmark (2 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulation Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                手戻り工数削減推移シミュレーション
              </h2>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
              ROI: 約 320% 達成
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            演習受講セッション数増加に伴う、実務レビュー差し戻し率および障害発生率の推移試算。
          </p>

          {/* SVG Visual Graph */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="h-44 w-full flex flex-col justify-between">
              {/* Simple illustrative SVG trend graph */}
              <svg viewBox="0 0 400 120" className="w-full h-28 overflow-visible">
                <defs>
                  <linearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Grid Lines */}
                <line x1="20" y1="20" x2="380" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="20" y1="60" x2="380" y2="60" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="20" y1="100" x2="380" y2="100" stroke="#1e293b" />

                {/* Area */}
                <path
                  d="M 40 25 Q 120 40, 200 65 T 360 95 L 360 100 L 40 100 Z"
                  fill="url(#blueGrad)"
                />

                {/* Trend Line (Handback Hours: 100h -> 20h) */}
                <path
                  d="M 40 25 Q 120 40, 200 65 T 360 95"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Points */}
                <circle cx="40" cy="25" r="4" fill="#818cf8" />
                <circle cx="120" cy="40" r="4" fill="#818cf8" />
                <circle cx="200" cy="65" r="4" fill="#818cf8" />
                <circle cx="280" cy="80" r="4" fill="#818cf8" />
                <circle cx="360" cy="95" r="5" fill="#38bdf8" />
              </svg>

              <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                <span>導入前（基準）</span>
                <span>1ヶ月後</span>
                <span>2ヶ月後</span>
                <span>現在（3ヶ月）</span>
                <span className="text-blue-400 font-semibold">6ヶ月予測</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">手戻り工数（月間）</span>
              <span className="text-base font-bold text-white mt-0.5 block">
                380h → <span className="text-emerald-400">140h (-63%)</span>
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">本番不備流出率</span>
              <span className="text-base font-bold text-white mt-0.5 block">
                4.2% → <span className="text-emerald-400">1.1% (-74%)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Benchmark Comparison */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                業界・共通アンカー基準ベンチマーク比較
              </h2>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              上位 22% 水準
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            項目応答理論（IRT）で尺度較正された共通アンカー規準に基づく、他社・業界平均との相対的ポジショニング。
          </p>

          <div className="space-y-4 pt-2">
            {/* Metric 1 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-200 font-medium">貴社全体水準</span>
                <span className="font-mono text-blue-400 font-bold">Band 3.4 (SS 58.4)</span>
              </div>
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full w-[68%]" />
              </div>
            </div>

            {/* Metric 2 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">FinTech・金融SaaS業界平均</span>
                <span className="font-mono text-slate-400">Band 3.2 (SS 54.0)</span>
              </div>
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div className="h-full bg-slate-700 rounded-full w-[60%]" />
              </div>
            </div>

            {/* Metric 3 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Web / 一般SaaS業界平均</span>
                <span className="font-mono text-slate-400">Band 2.8 (SS 48.2)</span>
              </div>
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div className="h-full bg-slate-800 rounded-full w-[52%]" />
              </div>
            </div>

            {/* Metric 4 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">業界トップ10%先進組織</span>
                <span className="font-mono text-emerald-400">Band 4.1 (SS 66.5)</span>
              </div>
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div className="h-full bg-emerald-700/60 rounded-full w-[82%]" />
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 leading-relaxed">
            <span className="text-white font-semibold block mb-0.5">💡 示唆とネクストアクション</span>
            貴社は全体としてWeb業界平均を大きく上回っていますが、部署間の検証力分散（SREの4.2に対しフロントエンドの2.7）が課題です。横展開ナレッジシェア演習が有効です。
          </div>
        </div>
      </div>

      {/* Bottom CTA to Interactive Session */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/80 border border-blue-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
            <Sparkles className="w-4 h-4" />
            <span>コア技術の稼働（Feasibility）を確認する</span>
          </div>
          <h3 className="text-lg font-bold text-white">
            中核評価エンジンによる実務ロールプレイング演習を体験
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            AI同僚との動的対話、ソクラテス型深掘り・What-if注入、CFF事前暫定判断、およびAutoSCOREによる2段階根拠抽出＆軸4採点を実際に動かせます。
          </p>
        </div>

        <button
          onClick={onStartSession}
          className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
        >
          <span>演習セッションを開始</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
