"use client";

import React from "react";
import { Sparkles, RefreshCw, ArrowRight, Anchor } from "lucide-react";
import { DYNAMIC_TASKS, type DynamicTaskScenario } from "@/data/dynamic-task";

interface InitStepProps {
  selectedTaskId: string;
  setSelectedTaskId: (id: string) => void;
  selectedTask: DynamicTaskScenario;
  isSubmitting: boolean;
  onStartSession: () => void;
  onGoToAnchorTab?: () => void;
}

export function InitStep({
  selectedTaskId,
  setSelectedTaskId,
  selectedTask,
  isSubmitting,
  onStartSession,
  onGoToAnchorTab,
}: InitStepProps) {
  return (
    <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
      <div className="flex items-center gap-3 text-blue-400 font-semibold text-sm">
        <Sparkles className="w-5 h-5" />
        <span>動的コンピテンシー アセスメント＆テレメトリ基盤（Feasibility 実証）</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          動的実務演習セッション（AI同僚協働・レビュー対話）
        </h1>
        <p className="text-slate-300 text-sm leading-relaxed mt-2">
          受講者が生成AIと協働しながら、不確実な実務課題に取り組むプロセス全体を通じて、
          <strong>動的コンピテンシー4領域（評価的判断力、高次認知・動的思考、対話的共創力、メタ認知・適応力）</strong>
          を観測・評価します。
        </p>
      </div>

      {/* 5場面のセッションフロー案内 */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
          演習セッションの動作フロー（全5場面・提案書 ①3 準拠）
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-blue-400 font-bold block">場面 1</span>
            <span className="font-semibold text-white block">課題提示・精査</span>
            <p className="text-[11px] text-slate-400 leading-tight">要件・コード・テストの精査と着眼点の整理</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-indigo-400 font-bold block">場面 2</span>
            <span className="font-semibold text-white block">反駁対話</span>
            <p className="text-[11px] text-slate-400 leading-tight">AI同僚の自説弁護に対し仕様根拠で反駁・修正指示</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/90 border border-rose-900/40 space-y-1 bg-rose-950/20">
            <span className="text-[10px] font-mono text-rose-400 font-bold block">場面 3 ⚡</span>
            <span className="font-semibold text-rose-200 block">前提変化（緊急仕様変更）</span>
            <p className="text-[11px] text-rose-300/80 leading-tight">突然の制約変更に対する方針の再適応と方針更新</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-purple-400 font-bold block">場面 4</span>
            <span className="font-semibold text-white block">意思決定（CFF）</span>
            <p className="text-[11px] text-slate-400 leading-tight">AI採点前に［承認／条件付き承認／修正要求］を先行確定</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-emerald-400 font-bold block">場面 5</span>
            <span className="font-semibold text-white block">AutoSCORE XAI診断</span>
            <p className="text-[11px] text-slate-400 leading-tight">2段階客観評価・根拠ハイライト・異議申立導線</p>
          </div>
        </div>
      </div>

      {/* 課題選択 */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          取り組む動的課題の選択（T-06a タスクレジストリ / 全{DYNAMIC_TASKS.length}件）
        </label>
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          {DYNAMIC_TASKS.map((t) => (
            <option key={t.task_id} value={t.task_id}>
              [{t.task_id}] {t.title}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>ドメイン: <strong className="text-slate-200">{selectedTask.domain}</strong></span>
          <span className="text-rose-400/90 flex items-center gap-1 font-mono text-[11px]">
            ⚡ 場面3 前提変化シナリオ同梱（{selectedTask.premise_shift?.title.slice(0, 24)}…）
          </span>
        </div>
      </div>

      {/* 共通アンカーの案内 */}
      <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs text-blue-300/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Anchor className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>共通アンカー評価について:</strong>
            採点器ドリフト検知・尺度等化のための固定設問（SCT型）は、上部ナビゲーションの
            <strong>「② 共通アンカー評価」</strong>タブから個別にいつでも体験できます。
            （運用時の挿入場所や頻度は実証PoCを経て決定するため、プロトタイプでは両者を分離して体験可能にしています）
          </p>
        </div>
        {onGoToAnchorTab && (
          <button
            type="button"
            onClick={onGoToAnchorTab}
            className="px-3 py-1.5 rounded-lg bg-blue-900/50 hover:bg-blue-800/60 text-blue-200 border border-blue-700/50 shrink-0 font-medium transition-colors"
          >
            アンカー評価を見る
          </button>
        )}
      </div>

      <button
        onClick={onStartSession}
        disabled={isSubmitting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 text-sm"
      >
        {isSubmitting ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <>
            実務演習セッションを開始する（課題提示へ）
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
