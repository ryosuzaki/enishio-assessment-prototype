"use client";

import React from "react";
import { Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { DYNAMIC_TASKS, type DynamicTaskScenario } from "@/data/dynamic-task";
import { isRetiredBankSource, type AnchorBankSourceView } from "../types";

interface InitStepProps {
  selectedAnchorId: string;
  setSelectedAnchorId: (id: string) => void;
  anchorList: { anchor_id: string; title: string; family: string }[];
  /** 読み込めたバンクの供給源。null は未取得 */
  bankSource: AnchorBankSourceView | null;
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
  bankSource,
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
        <div className="flex items-start justify-between gap-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            出題する共通アンカー項目（全{anchorList.length}項目から選択）
          </label>
          {bankSource === "demo_sample_v2" && (
            <span
              data-testid="anchor-bank-source-badge"
              className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/50"
            >
              公開デモ用サンプル
            </span>
          )}
        </div>
        <select
          value={selectedAnchorId}
          onChange={(e) => setSelectedAnchorId(e.target.value)}
          disabled={anchorList.length === 0}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          {anchorList.map((a) => (
            <option key={a.anchor_id} value={a.anchor_id}>
              [{a.anchor_id}] {a.title} ({a.family === "A" ? "設計領域" : "プロセス領域"})
            </option>
          ))}
        </select>
        {isRetiredBankSource(bankSource) ? (
          /* 退役形式を現行形式に見せない [D-83] */
          <p className="text-xs text-red-300/80 leading-relaxed">
            ⚠️ <strong>退役形式（v1-static）のバンクを読み込んでいます</strong>[D-83]。
            選択肢が答えを含むため「言われずに気づく」という測定対象が失われており、
            <strong>較正・等化に用いてはなりません。</strong>
            現行形式（v2-sct）は <code>src/data/anchors.v2.sample.json</code> にあります。
          </p>
        ) : bankSource === "demo_sample_v2" ? (
          /* サンプルを運用バンクに見せない。何が動いていないかを正直に書く */
          <p className="text-xs text-amber-200/70 leading-relaxed">
            ※ここに出ているのは<strong>リポジトリ同梱の公開デモ用サンプル項目（v2-sct・3項目）</strong>です。
            運用中の共通アンカー項目バンクは、受検者への事前露出を避けるため公開していません
            （項目露出は MVP 2.6.2 の監視指標）。項目の中身は違いますが、出題から
            `anchor_responses` への無得点記録までの経路は運用時と同一です。
            3項目のうち1項目は<strong>類型C（仕込んだ不備が無い項目）</strong>で、
            「とりあえず条件付きを選ぶ」戦略が失敗するようにしてあります。
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            ※実稼働時はセッション列の7回に1回、ランダムに自動混入されます（`anchor_status: pretest`・無得点運用）。
          </p>
        )}
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
