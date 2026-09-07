"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Scale,
  ArrowRightLeft,
  Anchor,
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
  prelimAction?: "approve" | "remand" | "";
  prelimJustification?: string;
  anchorId?: string;
  anchorStatus?: string;
  bankSource?: "operational" | "demo_sample" | null;
  q1Choice?: string;
  q2Choice?: string;
  confidence?: number;
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
  prelimAction,
  prelimJustification,
  anchorId,
  anchorStatus,
  bankSource,
  q1Choice,
  q2Choice,
  confidence,
  disputeReason,
  setDisputeReason,
  disputeDirection,
  setDisputeDirection,
  disputeSubmitted,
  onSubmitDispute,
  onResetToInit,
}: EvaluationReportStepProps) {
  const components = evaluation?.evidenceComponents ?? [];
  const matchedFlaws = Array.from(
    new Set(
      components
        .map((c) => c?.injected_flaw_id)
        .filter((id): id is string => Boolean(id))
    )
  );

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
            採点器の確信度が閾値（{evaluation.confidenceThreshold.toFixed(2)}）を下回ったため（
            {evaluation.scoringConfidence.toFixed(2)}）、バンドを確定させず
            `rater_type = pending_human` として記録しました。評点は人間の評価者が確認してから確定します。
          </p>
          {evaluation.isDemoThresholdOverride && (
            <p
              className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-700/60 pt-1.5"
              data-testid="demo-threshold-override-note"
            >
              ※ この閾値は `HITL_DEMO_CONFIDENCE_THRESHOLD` によりデモ用に引き上げられています。
              採点器が実際に返した確信度（{evaluation.scoringConfidence.toFixed(2)}）自体は変更していません。
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-900/40 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            これは開発中の推定器による「暫定値」です
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            妥当性は未検証であり、能力の確定的な評価ではありません。ルーブリックの行動記述に対する位置づけであって、
            他者との比較・序列ではありません。判定に納得できない場合は下の異議申立からお知らせください
            （申立の有無は評点に影響しません）。
            <span className="ml-1 font-mono text-amber-200/60">
              確信度 {evaluation.scoringConfidence.toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {/* 共通アンカー課題（別の測定量・並置提示） [D-60, P-16] */}
      <div
        className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4"
        data-testid="anchor-parallel-report-block"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Anchor className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              共通アンカー課題（別の測定量・並置提示）
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
              固定刺激（無得点記録・尺度較正用）
            </span>
            {anchorStatus && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                status: {anchorStatus}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 block">出題項目 ID / 供給源</span>
            <div className="font-mono text-slate-200 font-semibold flex items-center gap-1.5 flex-wrap">
              <span>{anchorId || "—"}</span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {bankSource === "operational"
                  ? "運用バンク"
                  : bankSource === "demo_sample"
                  ? "公開デモ用サンプル"
                  : "項目バンク"}
              </span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 block">受検者回答（選択肢）</span>
            <div className="font-mono text-slate-200 font-semibold">
              設問1: <span className="text-blue-400">{q1Choice || "—"}</span> ／ 設問2: <span className="text-indigo-400">{q2Choice || "—"}</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 block">自己評定確信度</span>
            <div className="font-mono text-slate-200 font-semibold">
              {confidence ? `${confidence} / 5` : "—"}
              <span className="text-[10px] font-normal text-slate-400 ml-1.5">
                ({confidence === 1 ? "全く自信なし" : confidence === 2 ? "やや不安" : confidence === 3 ? "普通" : confidence === 4 ? "やや自信あり" : confidence === 5 ? "非常に確信" : ""})
              </span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/30 text-[11px] text-slate-400 space-y-1 leading-relaxed">
          <div className="flex items-center gap-1.5 text-blue-300 font-semibold text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span>尺度連結および並置提示に関する設計上の原則（[P-16] [D-60]）</span>
          </div>
          <p>
            共通アンカー課題は<strong>固定刺激</strong>であり、<strong>対話セッションの評点とは別の測定量</strong>です。両者を同一尺度へ等化・合算していません。
            &theta; 尺度の較正には項目バンク全体で <span className="font-mono text-slate-300">N &ge; 150〜200</span> の応答が必要であり、<strong>本プロトタイプでは &theta; を算出していません</strong>。
          </p>
        </div>
      </div>

      {/* CFF Discrepancy Highlighting [MVP 2.5, Buçinca et al. 2021, D-80] */}
      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 space-y-3" data-testid="discrepancy-highlighting-block">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              認知強制機能（CFF）：事前採否判断とAI検証結果の対照
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
            Discrepancy Highlighting
          </span>
        </div>

        {/* 採否判断 vs 抽出された検証行動 */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
          <div className="text-[11px] font-bold text-slate-300">
            採否判断と抽出された検証行動の対照
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400">受講者の事前採否判断（Force Decision First）:</span>
              <span
                className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded ${
                  prelimAction === "approve"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                    : prelimAction === "remand"
                    ? "bg-rose-950 text-rose-300 border border-rose-800/50"
                    : "text-slate-400"
                }`}
                data-testid="prelim-action-display"
              >
                {prelimAction === "approve"
                  ? "承認 (Approve)"
                  : prelimAction === "remand"
                  ? "差し戻し (Remand)"
                  : "未選択"}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400">抽出された不備指摘:</span>
                <span className="font-mono text-[11px] text-slate-200" data-testid="matched-flaws-count">
                  {matchedFlaws.length > 0 ? `${matchedFlaws.length}件 (${matchedFlaws.join(", ")})` : "0件"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 px-1 pt-1 leading-relaxed" data-testid="action-collate-message">
              {prelimAction === "approve" && matchedFlaws.length > 0
                ? `受講者はドラフトを「承認」と判断しましたが、対話ログからは仕込み不備（${matchedFlaws.join(", ")}）に対応する検証行動が抽出されています。`
                : prelimAction === "remand" && matchedFlaws.length > 0
                ? `受講者の「差し戻し」判断と、AI採点器が抽出した仕込み不備（${matchedFlaws.join(", ")}）への検証行動が対応しています。`
                : prelimAction === "remand" && matchedFlaws.length === 0
                ? "受講者は「差し戻し」と判断しましたが、仕込み不備に対する直接の検証行動は抽出されませんでした。"
                : "受講者の「承認」判断と、不備指摘の非抽出状態が一致しています。"}
            </p>
          </div>

        {prelimJustification && (
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 space-y-1" data-testid="prelim-justification-display">
            <span className="text-[10px] text-slate-400 font-mono block">受講者の事前理由記述（Mandatory Justification）:</span>
            <p className="italic text-slate-200 pl-1 leading-relaxed">&quot;{prelimJustification}&quot;</p>
          </div>
        )}
      </div>

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

        {evaluation.probeConsistency && (
          <div
            className="p-4 rounded-xl bg-cyan-950/25 border border-cyan-900/40 space-y-2"
            data-testid="probe-consistency-block"
          >
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              深掘りへの応答の一貫性（Probe Consistency）
            </h3>
            {evaluation.probeConsistency.score === null ? (
              <p className="text-xs text-cyan-200/70 leading-relaxed italic">
                このセッションでは深掘り（ソクラテス型深掘り・What-if注入）が発生しなかったため、
                判定対象がありません。
              </p>
            ) : (
              <>
                <p className="text-xs text-cyan-200/90 font-mono">
                  {evaluation.probeConsistency.score.toFixed(2)}
                </p>
                <p className="text-xs text-cyan-200/80 leading-relaxed">
                  {evaluation.probeConsistency.rationale}
                </p>
              </>
            )}
          </div>
        )}
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
            const speakerLabel =
              msg.role === "user"
                ? "You (受講者)"
                : msg.role === "mediator"
                  ? "進行役（媒介プローブ）"
                  : "AI Peer (同僚エージェント)";
            return (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.role === "user"
                    ? "items-end"
                    : msg.role === "mediator"
                      ? "items-center"
                      : "items-start"
                }`}
              >
                <div className="text-[10px] text-slate-500 mb-1 font-mono">
                  {speakerLabel} ・ Turn {msg.turnSeq}
                </div>
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600/90 text-white rounded-tr-sm"
                      : msg.role === "mediator"
                        ? "bg-cyan-950/40 text-cyan-100 border border-cyan-800/50 italic"
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
