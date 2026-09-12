"use client";

import React, { useState } from "react";
import {
  Award,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  GitPullRequest,
  Play,
  ArrowRight,
  ShieldCheck,
  Clock,
  MessageSquare,
  Sparkles,
  HelpCircle,
  TrendingDown,
  Layers,
  FlaskConical,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  SCENARIO_BENCHMARKS,
  type ScenarioBenchmark,
  type BenchmarkPersona,
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
    initialTaskId || SCENARIO_BENCHMARKS[0].taskId
  );

  const currentBenchmark: ScenarioBenchmark =
    SCENARIO_BENCHMARKS.find((b) => b.taskId === selectedTaskId) || SCENARIO_BENCHMARKS[0];

  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    currentBenchmark.personas[0]?.id || "expert"
  );

  // When task changes, reset to expert persona
  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    const target = SCENARIO_BENCHMARKS.find((b) => b.taskId === taskId);
    if (target && target.personas.length > 0) {
      setSelectedPersonaId(target.personas[0].id);
    }
  };

  const currentPersona: BenchmarkPersona =
    currentBenchmark.personas.find((p) => p.id === selectedPersonaId) ||
    currentBenchmark.personas[0];

  const getPersonaBadgeClasses = (type: BenchmarkPersona["personaType"], active: boolean) => {
    if (!active) {
      return "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200";
    }
    switch (type) {
      case "expert":
        return "bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/40";
      case "competent":
        return "bg-blue-950/50 border-blue-500 text-blue-300 shadow-lg shadow-blue-950/40";
      case "hesitant":
        return "bg-amber-950/50 border-amber-500 text-amber-300 shadow-lg shadow-amber-950/40";
      case "blind":
        return "bg-rose-950/50 border-rose-500 text-rose-300 shadow-lg shadow-rose-950/40";
    }
  };

  const getHighlightBadgeClasses = (color: string) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-950/70 border-emerald-600/50 text-emerald-300";
      case "blue":
        return "bg-blue-950/70 border-blue-600/50 text-blue-300";
      case "purple":
        return "bg-purple-950/70 border-purple-600/50 text-purple-300";
      case "amber":
        return "bg-amber-950/70 border-amber-600/50 text-amber-300";
      case "rose":
        return "bg-rose-950/70 border-rose-600/50 text-rose-300";
      default:
        return "bg-slate-800 border-slate-700 text-slate-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Viability & Debriefing
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                実運用DBスキーマ準拠（PromptTurn / Rating 自動集約対応）
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
              <Award className="w-6 h-6 text-amber-400" />
              <span>シナリオ別行動比較ギャラリー（専門家・他受講者ベンチマーク）</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              AI時代の技術組織における意思決定の質（Level 1〜5）を可視化。専門家（テックリード）のお手本トレースと、現場で頻発する典型的な失敗・停滞パターンを対比し、受講者の腹落ち（事後講評）と組織の技術評価基準の統一を支援します。
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700 transition-all"
              >
                ダッシュボードへ
              </button>
            )}
            <button
              onClick={() => onStartSession(selectedTaskId)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>この課題の演習を解いてみる</span>
            </button>
          </div>
        </div>

        {/* Scenario Selection Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1">
          {SCENARIO_BENCHMARKS.map((benchmark) => (
            <button
              key={benchmark.taskId}
              onClick={() => handleTaskChange(benchmark.taskId)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 border ${
                selectedTaskId === benchmark.taskId
                  ? "bg-slate-800 text-blue-300 border-blue-500/50 shadow-sm"
                  : "bg-slate-950/50 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>{benchmark.taskTitle}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                {benchmark.totalSessions}件蓄積
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Overview & Trap Insight Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Trap Insight */}
        <div className="lg:col-span-7 glass-panel p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>【急所インサイト】{currentBenchmark.trapInsight.title}</span>
          </div>
          <div className="text-xs font-semibold text-amber-200 bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/40">
            📊 {currentBenchmark.trapInsight.statHighlight}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentBenchmark.trapInsight.description}
          </p>
          <div className="text-[11px] text-slate-400 pt-1">
            <span className="font-bold text-amber-300/80">根本原因：</span>
            {currentBenchmark.trapInsight.rootCause}
          </div>
        </div>

        {/* Right: Score Distribution */}
        <div className="lg:col-span-5 glass-panel p-4 rounded-xl border border-slate-800 bg-slate-950/50 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                受講者の評価バンド分布
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                N = {currentBenchmark.totalSessions} 名
              </span>
            </div>
            <div className="space-y-1.5 pt-2">
              {currentBenchmark.bandDistribution.map((item) => (
                <div key={item.band} className="flex items-center gap-2 text-xs">
                  <span className="w-36 text-[11px] text-slate-300 truncate">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="w-9 text-right font-mono text-[11px] text-slate-300">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 text-right">
            ※ 本番稼働時はPrisma DBの `ratings` テーブルからリアルタイム集計
          </div>
        </div>
      </div>

      {/* 4 Archetype Personas Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>比較対象：代表的な4つの行動パターン（ペルソナ）を選択</span>
          </div>
          <span className="text-xs text-slate-400">
            選択中のペルソナ: <strong className="text-slate-200">{currentPersona.avatarBadge}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {currentBenchmark.personas.map((persona) => {
            const isActive = selectedPersonaId === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => setSelectedPersonaId(persona.id)}
                className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-[120px] ${getPersonaBadgeClasses(
                  persona.personaType,
                  isActive
                )}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs truncate">{persona.avatarBadge}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 border border-white/10 shrink-0">
                      Band {persona.ratingCategory}
                    </span>
                  </div>
                  <div className="font-medium text-slate-200 text-[11px] truncate">
                    {persona.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{persona.roleTitle}</div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {persona.timeSpent}
                  </span>
                  <span>{persona.turnCount}ターン</span>
                  <span
                    className={`font-semibold ${
                      persona.prelimAction === "remand" ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {persona.prelimAction === "remand" ? "差し戻し" : "承認"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Persona Detailed Trace View */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-6">
        {/* Persona Header Summary */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                {currentPersona.avatarBadge}
              </span>
              <span className="text-sm font-bold text-slate-100">{currentPersona.name}</span>
              <span className="text-xs text-slate-400">（{currentPersona.roleTitle}）</span>
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-3 pt-1">
              <span>所要時間: <strong className="text-slate-200">{currentPersona.timeSpent}</strong></span>
              <span>対話ターン数: <strong className="text-slate-200">{currentPersona.turnCount}</strong></span>
              <span>最終評定: <strong className="text-blue-400">{currentPersona.ratingLabel}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Test inspection status */}
            <div className="px-3 py-1.5 rounded-xl text-xs font-mono border flex items-center gap-1.5 bg-slate-900/80 border-slate-800">
              <FlaskConical className={`w-3.5 h-3.5 ${currentPersona.testInspected ? "text-amber-400" : "text-slate-500"}`} />
              <span className="text-slate-300">テストコード検証:</span>
              <span className={currentPersona.testInspected ? "text-amber-300 font-bold" : "text-slate-500"}>
                {currentPersona.testInspected ? "実施" : "未確認"}
              </span>
            </div>

            {/* Preliminary Action (CFF) */}
            <div className="px-3 py-1.5 rounded-xl text-xs font-mono border flex items-center gap-1.5 bg-slate-900/80 border-slate-800">
              <span className="text-slate-300">事前採否判断:</span>
              <span
                className={`font-bold ${
                  currentPersona.prelimAction === "remand" ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {currentPersona.prelimAction === "remand" ? "差し戻し (Remand)" : "即時承認 (Approve)"}
              </span>
            </div>
          </div>
        </div>

        {/* Preliminary Justification & Inspection Note */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-blue-400" />
              受講者が入力した事前判断の理由（CFF Mandatory Justification）
            </span>
            <p className="text-slate-200 leading-relaxed italic bg-slate-950/50 p-2 rounded border border-slate-800/40">
              "{currentPersona.prelimJustification}"
            </p>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <FlaskConical className="w-3 h-3 text-amber-400" />
              テストコード確認時の行動特性
            </span>
            <p className="text-slate-200 leading-relaxed bg-slate-950/50 p-2 rounded border border-slate-800/40">
              {currentPersona.testInspectionNote}
            </p>
          </div>
        </div>

        {/* 2-Column Split: (Left) Dialogue Transcript / (Right) Diff & Evaluator Commentary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Dialogue Transcript (60%) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                実際の対話ログ（Dialogue Transcript）
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {currentPersona.dialogueTranscript.length} メッセージ
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {currentPersona.dialogueTranscript.map((turn, idx) => {
                const isUser = turn.role === "user";
                const isMediator = turn.role === "mediator";
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                      <span>Turn #{turn.turnSeq}</span>
                      <span>•</span>
                      <span>
                        {isUser
                          ? `${currentPersona.name}（受講者）`
                          : isMediator
                          ? "第三者の進行役（メディエーター）"
                          : "AI同僚（開発エージェント）"}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-xl text-xs leading-relaxed max-w-[92%] border whitespace-pre-wrap ${
                        isUser
                          ? "bg-blue-950/40 text-blue-100 border-blue-800/50"
                          : isMediator
                          ? "bg-purple-950/40 text-purple-200 border-purple-800/50"
                          : "bg-slate-900 text-slate-200 border-slate-800"
                      }`}
                    >
                      {turn.content}
                    </div>

                    {turn.highlightBadge && (
                      <div
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 ${getHighlightBadgeClasses(
                          turn.highlightBadge.color
                        )}`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{turn.highlightBadge.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Code Diff & Evaluator Commentary (40%) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Artifact Diff */}
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  最終成果物のコード差分
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentPersona.finalArtifactDiff.title}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-400 space-y-1">
                  <div className="text-[10px] text-rose-400 font-bold">初期ドラフト（修正前）:</div>
                  <pre className="text-slate-300 overflow-x-auto whitespace-pre">
                    {currentPersona.finalArtifactDiff.originalSnippet}
                  </pre>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-400 space-y-1">
                  <div className="text-[10px] text-emerald-400 font-bold">受講者の指示後（修正後）:</div>
                  <pre className="text-emerald-300/90 overflow-x-auto whitespace-pre">
                    {currentPersona.finalArtifactDiff.modifiedSnippet}
                  </pre>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal pt-1">
                {currentPersona.finalArtifactDiff.description}
              </p>
            </div>

            {/* AutoSCORE & Debriefing Commentary */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-indigo-950/60 bg-gradient-to-b from-indigo-950/20 to-slate-900 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-indigo-900/30">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  AutoSCORE 採点根拠 & エキスパート講評
                </span>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                  確信度 {(currentPersona.evaluatorCommentary.scoringConfidence * 100).toFixed(0)}%
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-slate-300">抽出された検証根拠要約：</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed pt-0.5">
                    {currentPersona.evaluatorCommentary.evidenceSummary}
                  </p>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 space-y-1">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    合否を分けた意思決定の分岐点（Key Decision Point）
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {currentPersona.evaluatorCommentary.decisionPoint}
                  </p>
                </div>

                <div className="bg-blue-950/30 p-2.5 rounded-lg border border-blue-900/40 space-y-1">
                  <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    教育的示唆（Learning Takeaway）
                  </span>
                  <p className="text-[11px] text-blue-200 leading-relaxed">
                    {currentPersona.evaluatorCommentary.keyLearningTakeaway}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
