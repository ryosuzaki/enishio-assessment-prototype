"use client";

import React from "react";
import { Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { DYNAMIC_TASKS, type DynamicTaskScenario } from "@/data/dynamic-task";

interface InitStepProps {
  selectedAnchorId: string;
  setSelectedAnchorId: (id: string) => void;
  anchorList: { anchor_id: string; title: string; family: string }[];
  selectedTaskId: string;
  setSelectedTaskId: (id: string) => void;
  selectedTask: DynamicTaskScenario;
  isSubmitting: boolean;
  onStartSession: () => void;
}

export function InitStep({
  selectedAnchorId,
  setSelectedAnchorId,
  anchorList,
  selectedTaskId,
  setSelectedTaskId,
  selectedTask,
  isSubmitting,
  onStartSession,
}: InitStepProps) {
  return (
    <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
      <div className="flex items-center gap-3 text-blue-400 font-semibold text-sm">
        <Sparkles className="w-5 h-5" />
        <span>評価的判断力 動的アセスメント 縦切りプロトタイプ（W1〜W6）</span>
      </div>
      <h1 className="text-2xl font-bold text-white tracking-tight">
        評価的判断力 動的アセスメント＆テレメトリ基盤
      </h1>
      <p className="text-slate-300 text-sm leading-relaxed">
        本プロトタイプは、単一セッションが端から端まで通る縦切り1本の実装です。
        「①固定アンカー出題」→「②動的3ペイン対話セッション」→「③AutoSCORE 2段階根拠抽出＆軸4採点」→「④XAIレポート」の全フローを検証できます。
      </p>

      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          出題する共通アンカー項目（T-05バンク / 全20項目から選択）
        </label>
        <select
          value={selectedAnchorId}
          onChange={(e) => setSelectedAnchorId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          {anchorList.map((a) => (
            <option key={a.anchor_id} value={a.anchor_id}>
              [{a.anchor_id}] {a.title} ({a.family === "A" ? "設計領域" : "プロセス領域"})
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          ※実稼働時はセッション列の7回に1回、ランダムに自動混入されます（`anchor_status: pretest`・無得点運用）。
        </p>
      </div>

      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          取り組む動的課題（T-06a タスクレジストリ / 全{DYNAMIC_TASKS.length}件から選択）
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
        <p className="text-xs text-slate-500">
          ※選択した課題のドラフトコードをAI同僚がレビュー用に提示します（ドメイン: {selectedTask.domain}）。
        </p>
      </div>

      <button
        onClick={onStartSession}
        disabled={isSubmitting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
      >
        {isSubmitting ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <>
            セッションを開始する（アンカー出題へ）
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
