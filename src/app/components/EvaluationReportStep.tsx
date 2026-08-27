"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import {
  DISAGREEMENT_OPTIONS,
  type EvaluationResult,
  type EvidenceComponent,
  type ChatMessage,
} from "../types";

interface EvaluationReportStepProps {
  evaluation: EvaluationResult;
  chatHistory: ChatMessage[];
  disputeReason: string;
  setDisputeReason: (reason: string) => void;
  disputeDirection: string;
  setDisputeDirection: (direction: string) => void;
  disputeSubmitted: boolean;
  onSubmitDispute: () => void;
  onResetToInit: () => void;
}

// 対話ログの1メッセージ本文に対し、同一ターンの evidenceComponents.quoted_span が
// 部分一致する箇所を <mark> でハイライトする。完全一致は要求しない（LLM抽出のため）。
// 見つからない場合は何もハイライトせず、元の文字列（配列内の単一要素）を返す。
function renderChatContentWithHighlights(
  content: string,
  turnComponents: EvidenceComponent[]
): React.ReactNode[] {
  type Range = { start: number; end: number; comp: EvidenceComponent };
  const ranges: Range[] = [];
  for (const comp of turnComponents) {
    const span = comp.quoted_span;
    if (!span) continue;
    const idx = content.indexOf(span);
    if (idx === -1) continue; // 静かにフォールバック（エラーにしない）
    ranges.push({ start: idx, end: idx + span.length, comp });
  }
  if (ranges.length === 0) return [content];

  ranges.sort((a, b) => a.start - b.start);
  const accepted: Range[] = [];
  let lastEnd = -1;
  for (const r of ranges) {
    // 重複範囲は先勝ちでスキップ（<mark> の入れ子を避ける）
    if (r.start >= lastEnd) {
      accepted.push(r);
      lastEnd = r.end;
    }
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  accepted.forEach((r, idx) => {
    if (r.start > cursor) {
      nodes.push(content.slice(cursor, r.start));
    }
    const isFlawLinked = !!r.comp.injected_flaw_id;
    nodes.push(
      <mark
        key={`hl-${idx}`}
        title={`${r.comp.component_type} / ${r.comp.rationale_summary}`}
        className={
          isFlawLinked
            ? "bg-emerald-500/25 text-emerald-100 rounded px-0.5 not-italic"
            : "bg-indigo-500/20 text-indigo-100 rounded px-0.5 not-italic"
        }
      >
        {content.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < content.length) {
    nodes.push(content.slice(cursor));
  }
  return nodes;
}

export function EvaluationReportStep({
  evaluation,
  chatHistory,
  disputeReason,
  setDisputeReason,
  disputeDirection,
  setDisputeDirection,
  disputeSubmitted,
  onSubmitDispute,
  onResetToInit,
}: EvaluationReportStepProps) {
  return (
    <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white text-lg ${
              evaluation.isPendingHumanReview
                ? "bg-slate-700"
                : "bg-gradient-to-tr from-emerald-500 to-teal-500"
            }`}
          >
            {evaluation.isPendingHumanReview ? "—" : evaluation.ratingCategory}
          </div>
          <div>
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
              AutoSCORE 2段階評価結果（XAIレポート）
            </span>
            <h2 className="text-lg font-bold text-white">
              {evaluation.isPendingHumanReview
                ? "評点保留（人間の確認待ち）"
                : evaluation.levelLabel}
            </h2>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
          {evaluation.scorerModelVersion}
        </span>
      </div>

      {/* 暫定値ラベル [D-22]。スコア表示には必ず併記する */}
      {evaluation.isPendingHumanReview ? (
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-600 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <AlertCircle className="w-4 h-4 text-slate-400" />
            この判定は確定していません
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            採点器の確信度が閾値（0.70）を下回ったため（
            {evaluation.scoringConfidence.toFixed(2)}）、バンドを確定させず
            `rater_type = pending_human` として記録しました。評点は人間の評価者が確認してから確定します。
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            これは開発中の推定器による「暫定値」です
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            妥当性は未検証であり、能力の確定的な評価ではありません。固定した行動アンカーに対する位置づけであって、
            他者との比較・序列ではありません。判定に納得できない場合は下の異議申立からお知らせください
            （申立の有無は評点に影響しません）。
            <span className="ml-1 font-mono text-amber-200/60">
              確信度 {evaluation.scoringConfidence.toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {/* Rationale & Feedback */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            判定根拠（Evidence Summary）
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {evaluation.evidenceSummary}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/40 space-y-2">
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
            形成的診断アドバイス（Diagnostic Feedback）
          </h3>
          <p className="text-xs text-blue-200/90 leading-relaxed">
            {evaluation.diagnosticFeedback}
          </p>
        </div>
      </div>

      {/* Dialogue Log with Evidence Highlights [根拠ハイライト] */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          対話ログ（根拠ハイライト付き）
        </h3>
        <p className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/25 border border-emerald-500/40" />
            仕込み不備・正常箇所に対応する検証行動
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500/20 border border-indigo-500/40" />
            それ以外の一般的な検証行動
          </span>
        </p>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          {chatHistory.map((msg, i) => {
            const turnComponents = evaluation.evidenceComponents.filter(
              (c) => c.turn_index === msg.turnSeq
            );
            return (
              <div
                key={i}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div className="text-[10px] text-slate-500 mb-1 font-mono">
                  {msg.role === "user" ? "You (受講者)" : "AI Peer (同僚エージェント)"} ・ Turn {msg.turnSeq}
                </div>
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600/90 text-white rounded-tr-sm"
                      : "bg-slate-800/90 text-slate-100 rounded-tl-sm border border-slate-700/60"
                  }`}
                >
                  {renderChatContentWithHighlights(msg.content, turnComponents)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evidence Components Highlight Spans */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          抽出された受講者の検証行動スパン（Stage 1 構造化出力）
        </h3>
        <div className="space-y-2.5">
          {evaluation.evidenceComponents.map((comp, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
            >
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-purple-400 font-bold">
                  [Turn {comp.turn_index}] {comp.component_type}
                </span>
                {comp.injected_flaw_id && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Match: {comp.injected_flaw_id}
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-slate-200 bg-slate-900/80 p-2 rounded border border-slate-800/60 font-mono">
                &quot;{comp.quoted_span}&quot;
              </div>
              <p className="text-[11px] text-slate-400">{comp.rationale_summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Score Feedback & Dispute Section [MVP 4.5] */}
      <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 pt-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          評点に対する異議申立・フィードバック（MVP 4.5 準拠）
        </div>
        {disputeSubmitted ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            ✓ 異議申立が `score_feedback` テーブルへ記録されました。SME評価者による再検証対象となります。
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400">
                どこが違うと考えますか（必須）
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {DISAGREEMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-all ${
                      disputeDirection === opt.value
                        ? "border-blue-500 bg-blue-500/10 text-slate-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="disagreement_direction"
                      value={opt.value}
                      checked={disputeDirection === opt.value}
                      onChange={(e) => setDisputeDirection(e.target.value)}
                      className="accent-blue-500"
                    />
                    <span>{opt.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-500">
                      {opt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="「ターン3で触れたフォールバック要件の指摘が反映されていません」など、異議の理由を具体的に記述してください（必須）"
              className="w-full bg-slate-900 text-xs text-slate-200 p-3 rounded-xl border border-slate-700 resize-none h-20 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end">
              <button
                onClick={onSubmitDispute}
                disabled={!disputeReason.trim() || !disputeDirection}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 border border-slate-700 disabled:opacity-40"
              >
                異議を申し立てる（記録）
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 flex justify-between items-center border-t border-slate-800">
        <button
          onClick={onResetToInit}
          className="text-xs text-slate-400 hover:text-slate-200 underline"
        >
          ← トップへ戻り最初からやり直す
        </button>
        <div className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          W1〜W5 全フロー縦切り動作完了
        </div>
      </div>
    </div>
  );
}
