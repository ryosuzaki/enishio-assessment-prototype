"use client";

import React, { useState } from "react";
import {
  Play,
  ShieldCheck,
  Sparkles,
  FlaskConical,
  GitBranch,
  Filter,
  RefreshCw,
  Target,
  Cpu,
  BrainCircuit,
  Compass,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  Eye,
  Info,
} from "lucide-react";
import {
  SCENARIO_DEBRIEFINGS,
  type ScenarioDebriefingData,
  type CompetencyActionItem,
  type ObservationStatus,
} from "@/data/benchmark-gallery-data";

interface BenchmarkGalleryProps {
  initialTaskId?: string;
  onStartSession: (taskId: string) => void;
  onBackToDashboard?: () => void;
}

export function BenchmarkGallery({
  initialTaskId,
  onStartSession,
  onBackToDashboard,
}: BenchmarkGalleryProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    initialTaskId || SCENARIO_DEBRIEFINGS[0].taskId
  );

  const [statusFilter, setStatusFilter] = useState<"all" | "observed" | "not_observed" | "bookmarked">("all");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const currentScenario: ScenarioDebriefingData =
    SCENARIO_DEBRIEFINGS.find((b) => b.taskId === selectedTaskId) || SCENARIO_DEBRIEFINGS[0];

  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    setSelectedRouteId(null);
  };

  const toggleBookmark = (actionId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  // Filter actions based on statusFilter
  const filterAction = (action: CompetencyActionItem) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "observed") return action.status === "observed";
    if (statusFilter === "not_observed") return action.status === "not_observed";
    if (statusFilter === "bookmarked") return bookmarkedIds.has(action.id);
    return true;
  };

  // Counts for summary
  const allActions = currentScenario.competencyGroups.flatMap((g) => g.actions);
  const observedCount = allActions.filter((a) => a.status === "observed").length;
  const notObservedCount = allActions.filter((a) => a.status === "not_observed").length;
  const currentScenarioBookmarkedCount = allActions.filter((a) => bookmarkedIds.has(a.id)).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 画面ヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              エキスパート事後講評＆デブリーフィング
            </div>
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
              >
                ← 組織分析ダッシュボードへ戻る
              </button>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight mb-2">
            シナリオ分析＆エキスパート検証戦略
          </h1>
          <p className="text-slate-400 text-sm max-w-3xl leading-relaxed">
            AIが仕掛けた欺瞞トリックの解剖、上位者が採用した複数の攻略ルート、そして観測された客観的行動ログ（テレメトリ）を対比します。
            限られたターン数の中でどのアプローチを選択するかは受講者の自律的判断です。説教や行動の強制を行わず、上位者のアプローチを客観的な選択肢・引き出しとして提供します。
          </p>
        </div>
      </div>

      {/* シナリオ選択タブ */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {SCENARIO_DEBRIEFINGS.map((scenario) => {
          const isSelected = scenario.taskId === selectedTaskId;
          return (
            <button
              key={scenario.taskId}
              onClick={() => handleTaskChange(scenario.taskId)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/50"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              <FlaskConical className={`w-4 h-4 ${isSelected ? "text-indigo-200" : "text-slate-500"}`} />
              <span>{scenario.taskTitle}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  isSelected ? "bg-indigo-700/80 text-indigo-100" : "bg-slate-800 text-slate-400"
                }`}
              >
                {scenario.domainLabel.split("/")[0].trim()}
              </span>
            </button>
          );
        })}
      </div>

      {/* 選択中シナリオの概要と受講者セッション連携バー */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
              <Compass className="w-3.5 h-3.5" />
              <span>{currentScenario.domainLabel}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">総受検セッション: N={currentScenario.totalSessions}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{currentScenario.taskTitle}</h2>
            <p className="text-xs text-slate-400">{currentScenario.shortSummary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400">データ母集団: </span>
                <span className="font-semibold text-slate-200">{currentScenario.topPerformerDefinition}</span>
              </div>
            </div>
            <button
              onClick={() => onStartSession(currentScenario.taskId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              この課題を解いてみる
            </button>
          </div>
        </div>

        {/* 今回のセッションログ照合結果 */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="font-medium text-slate-200">今回のセッションログ照合結果:</span>
            <span className="text-slate-400">観測された事実のみを客観的に照合表示しています</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 font-medium border border-blue-500/20">
              <Eye className="w-3.5 h-3.5" /> 該当（観測あり）: {observedCount}件
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-400 font-medium border border-slate-700">
              未観測（非該当）: {notObservedCount}件
            </span>
            {currentScenarioBookmarkedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20">
                <BookmarkCheck className="w-3.5 h-3.5" /> 参考になった: {currentScenarioBookmarkedCount}件
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          第1層：課題トラップ構造の解剖 (Trap Architecture)
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-rose-400 uppercase">Layer 01</div>
              <h3 className="text-base font-bold text-slate-100">課題トラップ構造の解剖（AIのミスリードと認知バイアス）</h3>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
            受講者全体の {currentScenario.trapArchitecture.overallMissRate}% が遭遇
          </div>
        </div>

        <div className="mb-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
          <div className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            {currentScenario.trapArchitecture.title}
          </div>
          <p className="text-xs text-slate-300 font-medium">
            💡 {currentScenario.trapArchitecture.statHighlight}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-1.5 text-indigo-300">
              <Cpu className="w-3.5 h-3.5" />
              AIが仕掛けた欺瞞のメカニズム（コード・テストのトリック）
            </div>
            <p className="text-slate-300 leading-relaxed">
              {currentScenario.trapArchitecture.aiDeceptionMechanism}
            </p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-1.5 text-amber-300">
              <BrainCircuit className="w-3.5 h-3.5" />
              人間が陥りやすい認知バイアス（心理的脆弱性）
            </div>
            <p className="text-slate-300 leading-relaxed">
              {currentScenario.trapArchitecture.cognitiveBias}
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          第2層：攻略ルート分岐図 (Strategy Branches)
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 relative">
        <div className="flex items-center justify-between gap-4 mb-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-blue-400 uppercase">Layer 02</div>
              <h3 className="text-base font-bold text-slate-100">上位者の攻略ルート分岐図（価値中立な戦略比較）</h3>
            </div>
          </div>
          <div className="text-xs text-slate-400">正解は1つではありません。各アプローチの特性を学べます</div>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          上位者層（Level 4〜5）は、単一の手順に依存せず、自身の強みやシチュエーションに応じた複数の有効な検証ルートを採用していました。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {currentScenario.strategyRoutes.map((route) => {
            const isSelected = selectedRouteId === route.id;
            return (
              <div
                key={route.id}
                onClick={() => setSelectedRouteId(isSelected ? null : route.id)}
                className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 ${
                  isSelected
                    ? "bg-blue-950/40 border-blue-500/60 shadow-md ring-1 ring-blue-500/30"
                    : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {route.badge}
                  </span>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-200">{route.adoptionRate}%</span>
                    <span className="text-[10px] text-slate-400 ml-1">が採用</span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-100 mb-2">{route.title}</h4>

                <div className="w-full bg-slate-800 h-1.5 rounded-full mb-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${route.adoptionRate}%` }}
                  />
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">🎯 適した状況:</span>
                    <p className="text-slate-300 text-[11px] mt-0.5">{route.targetContext}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">⚡️ 上位者の具体行動:</span>
                    <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{route.keyActionSummary}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400">⚖️ メリット・留意点:</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">{route.prosAndCons}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          第3層：動的コンピテンシー別・上位者アクション突合 (Competency Debriefing)
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase">Layer 03</div>
              <h3 className="text-base font-bold text-slate-100">動的コンピテンシー別・上位者アクションと観測事実</h3>
            </div>
          </div>

          {/* フィルターボタン */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              すべて表示
            </button>
            <button
              onClick={() => setStatusFilter("observed")}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === "observed" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              観測あり（{observedCount}）
            </button>
            <button
              onClick={() => setStatusFilter("not_observed")}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === "not_observed" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              未観測（{notObservedCount}）
            </button>
            <button
              onClick={() => setStatusFilter("bookmarked")}
              className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                statusFilter === "bookmarked" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookmarkCheck className="w-3 h-3" />
              参考になった（{currentScenarioBookmarkedCount}）
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          上位者が各コンピテンシー領域で実際に取った行動を客観的に抽出しています。
          限られたターン数の中での選択を尊重し、未観測の項目は「参考になった」ボタンでピン留めして自身の引き出しとしてストックできます。
        </p>

        <div className="space-y-8">
          {currentScenario.competencyGroups.map((group) => {
            const filteredActions = group.actions.filter(filterAction);
            if (filteredActions.length === 0) return null;

            return (
              <div key={group.domainId} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">{group.domainName}</span>
                  <span className="text-xs text-slate-500 font-mono">({group.domainEn})</span>
                </div>

                <div className="space-y-3">
                  {filteredActions.map((action) => {
                    const isObserved = action.status === "observed";
                    const isBookmarked = bookmarkedIds.has(action.id);

                    return (
                      <div
                        key={action.id}
                        className={`border rounded-xl p-4 transition-all ${
                          isObserved
                            ? "bg-slate-950/40 border-blue-500/30 hover:border-blue-500/50"
                            : "bg-slate-950/30 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                          <div className="flex items-start gap-2.5">
                            {isObserved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0 mt-0.5">
                                <Eye className="w-3.5 h-3.5" /> ログ観測あり
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 shrink-0 mt-0.5">
                                未観測
                              </span>
                            )}
                            <div>
                              <h5 className="text-sm font-bold text-slate-100">{action.title}</h5>
                              <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
                            </div>
                          </div>

                          {/* 統計ベンチマーク */}
                          <div className="flex items-center gap-4 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800 shrink-0 text-xs">
                            <div>
                              <div className="text-[10px] text-slate-400">上位者実施率</div>
                              <div className="font-bold text-indigo-400 text-sm">{action.topPerformerRate}%</div>
                            </div>
                            <div className="w-px h-6 bg-slate-800" />
                            <div>
                              <div className="text-[10px] text-slate-400">全体平均</div>
                              <div className="font-bold text-slate-300 text-sm">{action.overallRate}%</div>
                            </div>
                          </div>
                        </div>

                        {/* 詳細コンテンツ */}
                        <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-3 text-xs">
                          {isObserved ? (
                            <>
                              {/* 該当：観測されたあなたのアプローチ */}
                              <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-lg text-slate-200">
                                <div className="text-[11px] font-semibold text-blue-300 mb-1 flex items-center gap-1.5">
                                  <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                                  今回のセッションで観測されたあなたの切り口:
                                </div>
                                <p className="text-slate-300">{action.userApproach}</p>
                              </div>

                              {/* 該当：上位者の切り口バリエーション */}
                              <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg space-y-1.5">
                                <div className="text-[11px] font-semibold text-slate-300">
                                  📊 上位者に多く見られたアプローチ（切り口のバリエーション）:
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                                  {action.topPerformerApproaches.map((approach, idx) => (
                                    <li key={idx} className="leading-relaxed">
                                      <span className="text-slate-300">{approach}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* 非該当：未観測の説明と上位者アプローチ */}
                              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 text-slate-400">
                                ※ 今回の時間制限・ターン数配分の中では、このアプローチは観測されませんでした。
                              </div>

                              <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg space-y-1.5">
                                <div className="text-[11px] font-semibold text-slate-300">
                                  📊 上位者のアプローチ例（別解としての引き出し）:
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                                  {action.topPerformerApproaches.map((approach, idx) => (
                                    <li key={idx} className="leading-relaxed">
                                      <span className="text-slate-300">{approach}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* 自律的な「参考になった」ピン留めボタン */}
                              <div className="flex justify-end pt-1">
                                <button
                                  onClick={() => toggleBookmark(action.id)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isBookmarked
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                                      : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                  }`}
                                >
                                  {isBookmarked ? (
                                    <>
                                      <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                                      <span>参考になった（ピン留め中）</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                                      <span>💡 参考になった（ピン留めして保存）</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* フッターCTA */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <h4 className="text-base font-bold text-slate-100">別の角度・アプローチで課題を試してみますか？</h4>
          <p className="text-xs text-slate-400 mt-1">
            上位者の攻略ルートや新しい切り口を意識して、演習セッションを自由に再実行できます。
          </p>
        </div>
        <button
          onClick={() => onStartSession(currentScenario.taskId)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          この課題を解き直す
        </button>
      </div>
    </div>
  );
}
