"use client";

import React from "react";
import {
  DISAGREEMENT_OPTIONS,
  isRetiredBankSource,
  type AnchorBankSourceView,
  type EvaluationResult,
  type EvidenceComponent,
  type ChatMessage,
} from "../types";
import { Badge, Button, Card, cn, thresholdTone, toneChip } from "./ui";

interface EvaluationReportStepProps {
  evaluation: EvaluationResult;
  chatHistory: ChatMessage[];
  prelimAction?: "approve" | "remand" | "comment" | "";
  prelimJustification?: string;
  anchorId?: string;
  anchorStatus?: string;
  bankSource?: AnchorBankSourceView | null;
  stage1Choice?: string;
  stage2Choice?: string;
  stage3Choice?: number | null;
  confidence?: number;
  disputeReason: string;
  setDisputeReason: (reason: string) => void;
  disputeDirection: string;
  setDisputeDirection: (direction: string) => void;
  disputeSubmitted: boolean;
  onSubmitDispute: () => void;
  onResetToInit: () => void;
  onViewBenchmarkGallery?: () => void;
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
        className={cn(
          "rounded-chip px-0.5 not-italic text-ink",
          // 2 種のハイライトは「どの検証行動か」の区別であり、良し悪しの評価ではない。
          // 同じ色の濃淡違いでは並べたときに見分けがつかなかったため、
          // 仕込み不備に対応するものだけがアクセントを持ち、他は無彩色で沈める。
          isFlawLinked ? "bg-accent/20" : "bg-line-strong/50",
        )}
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

/** 4領域の観測サマリー1枚。領域ごとに色を割り当てない（[D-101]）。 */
function AxisCell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-chip border border-line bg-surface p-2.5">
      <p className="text-section text-ink">{title}</p>
      <p className="text-caption text-ink-2">{children}</p>
    </div>
  );
}

export function EvaluationReportStep({
  evaluation,
  chatHistory,
  prelimAction,
  prelimJustification,
  anchorId,
  anchorStatus,
  bankSource,
  stage1Choice,
  stage2Choice,
  stage3Choice,
  confidence,
  disputeReason,
  setDisputeReason,
  disputeDirection,
  setDisputeDirection,
  disputeSubmitted,
  onSubmitDispute,
  onResetToInit,
  onViewBenchmarkGallery,
}: EvaluationReportStepProps) {
  /**
   * 事前の採否判断と、AI が抽出した検証行動が噛み合っているか。
   * **CFF 画面で最初に見るべきはここ**なので、文章だけでなく面の色でも示す。
   */
  const components = evaluation?.evidenceComponents ?? [];
  const matchedFlaws = Array.from(
    new Set(
      components
        .map((c) => c?.injected_flaw_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const isJudgementConsistent =
    (prelimAction === "remand" && matchedFlaws.length > 0) ||
    (prelimAction === "comment" && matchedFlaws.length > 0) ||
    (prelimAction === "approve" && matchedFlaws.length === 0);

  return (
    <div className="space-y-block">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-card border text-title",
              evaluation.isPendingHumanReview
                ? "border-line-strong bg-surface-sunken text-ink-2"
                : Number(evaluation.ratingCategory) >= 4
                  ? "border-positive bg-positive text-white"
                  : Number(evaluation.ratingCategory) >= 3
                    ? "border-accent bg-accent text-white"
                    : "border-caution bg-caution text-white",
            )}
            data-numeric
          >
            {evaluation.isPendingHumanReview ? "—" : evaluation.ratingCategory}
          </span>
          <div className="space-y-0.5">
            <p className="text-caption text-ink-3">構造化採点パイプライン 2段階評価結果（XAIレポート）</p>
            <h2 className="text-title tracking-tight text-ink">
              {evaluation.isPendingHumanReview ? "評点保留（人間の確認待ち）" : evaluation.levelLabel}
            </h2>
          </div>
        </div>
        <span className="font-mono text-data text-ink-3">{evaluation.scorerModelVersion}</span>
      </header>

      {/* 暫定値ラベル [D-22]。スコア表示には必ず併記する */}
      {evaluation.isPendingHumanReview ? (
        <div className="space-y-1.5 rounded-card border border-line-strong bg-surface-sunken p-4">
          <p className="text-section text-ink">この判定は確定していません</p>
          <p className="text-caption text-ink-2">
            採点器の確信度が閾値（{evaluation.confidenceThreshold.toFixed(2)}）を下回ったため（
            {evaluation.scoringConfidence.toFixed(2)}）、バンドを確定させず `rater_type = pending_human`
            として記録しました。評点は人間の評価者が確認してから確定します。
          </p>
          {evaluation.isDemoThresholdOverride && (
            <p
              className="border-t border-line pt-1.5 text-caption text-ink-3"
              data-testid="demo-threshold-override-note"
            >
              ※ この閾値は `HITL_DEMO_CONFIDENCE_THRESHOLD` によりデモ用に引き上げられています。
              採点器が実際に返した確信度（{evaluation.scoringConfidence.toFixed(2)}）自体は変更していません。
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 rounded-card border border-caution/30 bg-caution-wash p-4">
          <p className="text-section text-ink">
            これは開発中の推定器による「暫定値」です
          </p>
          <p className="text-caption text-ink-2">
            妥当性は未検証であり、能力の確定的な評価ではありません。ルーブリックの行動記述に対する位置づけであって、
            他者との比較・序列ではありません。判定に納得できない場合は下の異議申立からお知らせください
            （申立の有無は評点に影響しません）。
            <span
              className={cn(
                "ml-1 font-semibold",
                toneChip(thresholdTone(evaluation.scoringConfidence, { good: 0.8, poor: 0.6 })),
              )}
              data-numeric
            >
              確信度 {evaluation.scoringConfidence.toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {/* 共通アンカー課題（別の測定量・並置提示） [D-60, P-16] */}
      <div data-testid="anchor-parallel-report-block">
        <Card
          title="共通アンカー課題（別の測定量・並置提示）"
          meta={
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">固定刺激（無得点記録・尺度較正用）</Badge>
              {anchorStatus && <Badge tone="neutral">status: {anchorStatus}</Badge>}
            </span>
          }
        >
          <div className="space-y-cell">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1 rounded-chip border border-line bg-surface-sunken p-3">
                <p className="text-caption text-ink-3">出題項目 ID / 供給源</p>
                <p className="flex flex-wrap items-center gap-1.5 font-mono text-data font-semibold text-ink">
                  <span>{anchorId || "—"}</span>
                  <Badge tone={isRetiredBankSource(bankSource ?? null) ? "caution" : "neutral"}>
                    {bankSource === "operational_v2"
                      ? "運用バンク (v2-sct)"
                      : bankSource === "demo_sample_v2"
                      ? "公開デモ用サンプル (v2-sct)"
                      : isRetiredBankSource(bankSource ?? null)
                      ? "退役形式 (v1-static)"
                      : "項目バンク"}
                  </Badge>
                </p>
              </div>
              <div className="space-y-1 rounded-chip border border-line bg-surface-sunken p-3">
                <p className="text-caption text-ink-3">受検者回答（段階1〜3）</p>
                <p className="text-data font-semibold text-ink" data-numeric>
                  1: {stage1Choice || "—"} ／ 2: {stage2Choice || "—"} ／ 3:{" "}
                  {stage3Choice === null || stage3Choice === undefined
                    ? "—"
                    : stage3Choice > 0
                    ? `+${stage3Choice}`
                    : String(stage3Choice)}
                </p>
              </div>
              <div className="space-y-1 rounded-chip border border-line bg-surface-sunken p-3">
                <p className="text-caption text-ink-3">自己評定確信度</p>
                <p className="text-data font-semibold text-ink" data-numeric>
                  {confidence ? `${confidence} / 5` : "—"}
                  <span className="ml-1.5 font-sans text-caption font-normal text-ink-2">
                    (
                    {confidence === 1
                      ? "全く自信なし"
                      : confidence === 2
                      ? "やや不安"
                      : confidence === 3
                      ? "普通"
                      : confidence === 4
                      ? "やや自信あり"
                      : confidence === 5
                      ? "非常に確信"
                      : ""}
                    )
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-1 rounded-chip border border-line bg-surface-sunken p-3.5 text-caption text-ink-2">
              <p className="text-section text-ink">
                尺度連結および並置提示に関する設計上の原則（[P-16] [D-60]）
              </p>
              <p>
                共通アンカー課題は<strong className="font-semibold text-ink">固定刺激</strong>であり、
                <strong className="font-semibold text-ink">対話セッションの評点とは別の測定量</strong>
                です。両者を同一尺度へ等化・合算していません。 &theta; 尺度の較正には項目バンク全体で{" "}
                <span className="text-ink">N &ge; 150〜200</span>{" "}
                の応答が必要であり、
                <strong className="font-semibold text-ink">本プロトタイプでは &theta; を算出していません</strong>。
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* CFF Discrepancy Highlighting [MVP 2.5, Buçinca et al. 2021, D-80] */}
      <div data-testid="discrepancy-highlighting-block">
        <Card
          title="認知強制機能（CFF）：事前採否判断とAI検証結果の対照"
          meta={<Badge tone="neutral">Discrepancy Highlighting</Badge>}
        >
          <div className="space-y-cell">
            {/* 採否判断 vs 抽出された検証行動 */}
            <div className="space-y-2 rounded-chip border border-line bg-surface-sunken p-3.5">
              <p className="text-section text-ink">採否判断と抽出された検証行動の対照</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 rounded-chip border border-line bg-surface p-2">
                  <span className="text-caption text-ink-2">
                    受講者の事前採否判断（Force Decision First）:
                  </span>
                  <span
                    className="text-data font-semibold text-ink"
                    data-testid="prelim-action-display"
                  >
                    {prelimAction === "approve"
                      ? "承認 (Approve)"
                      : prelimAction === "remand"
                      ? "修正要求 (Request Changes)"
                      : prelimAction === "comment"
                      ? "条件付き承認 (Comment)"
                      : "未選択"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-chip border border-line bg-surface p-2">
                  <span className="text-caption text-ink-2">抽出された不備指摘:</span>
                  <span className="text-data text-ink" data-testid="matched-flaws-count" data-numeric>
                    {matchedFlaws.length > 0
                      ? `${matchedFlaws.length}件 (${matchedFlaws.join(", ")})`
                      : "0件"}
                  </span>
                </div>
              </div>
              <p
                className={cn(
                  "rounded-chip border px-cell py-2 text-caption",
                  isJudgementConsistent
                    ? "border-positive/25 bg-positive-wash text-ink"
                    : "border-caution/30 bg-caution-wash text-ink",
                )}
                data-testid="action-collate-message"
              >
                {prelimAction === "approve" && matchedFlaws.length > 0
                  ? `受講者はドラフトを「承認」と判断しましたが、対話ログからは仕込み不備（${matchedFlaws.join(", ")}）に対応する検証行動が抽出されています。`
                  : prelimAction === "remand" && matchedFlaws.length > 0
                  ? `受講者の「修正要求」判断と、AI採点器が抽出した仕込み不備（${matchedFlaws.join(", ")}）への検証行動が対応しています。`
                  : prelimAction === "comment" && matchedFlaws.length > 0
                  ? `受講者は「条件付き承認」と判断し、不備（${matchedFlaws.join(", ")}）への検証行動を踏まえて追加条件付きでのリリースを指示しています。`
                  : prelimAction === "comment" && matchedFlaws.length === 0
                  ? "受講者は「条件付き承認」と判断しましたが、仕込み不備に対する直接の検証行動は抽出されませんでした。"
                  : prelimAction === "remand" && matchedFlaws.length === 0
                  ? "受講者は「修正要求」と判断しましたが、仕込み不備に対する直接の検証行動は抽出されませんでした。"
                  : "受講者の「承認」判断と、不備指摘の非抽出状態が一致しています。"}
              </p>
            </div>

            {/* 動的コンピテンシー4領域の観測サマリー */}
            <div className="space-y-2 rounded-chip border border-line bg-surface-sunken p-3.5">
              <p className="text-section text-ink">
                動的コンピテンシー 4領域の観測サマリー（提案書準拠）
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <AxisCell title="① 評価的判断力 (Evaluative Judgement)">
                  仕込み不備検出:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      matchedFlaws.length > 0 ? "text-positive" : "text-caution",
                    )}
                    data-numeric
                  >
                    {matchedFlaws.length}件
                  </span>
                  {matchedFlaws.length > 0 ? ` (${matchedFlaws.join(", ")})` : " (検出なし)"}
                </AxisCell>
                <AxisCell title="② 高次認知・動的思考 (Higher-Order Reasoning)">
                  前提トレードオフの言語化と、過剰指摘の回避（正常箇所の正当な弁別）
                </AxisCell>
                <AxisCell title="③ 対話的共創力 (Collaborative Co-Creation)">
                  AI同僚への建設的指示。対話ターン数{" "}
                  <span className="font-semibold text-ink" data-numeric>
                    {chatHistory.filter((m) => m.role === "user").length}ターン
                  </span>
                </AxisCell>
                <AxisCell title="④ メタ認知・適応力 (Metacognition &amp; Adaptability)">
                  緊急仕様変更（前提変化）への適応と、反論への応答（迎合回避）
                </AxisCell>
              </div>
            </div>

            {prelimJustification && (
              <div
                className="space-y-1 rounded-chip border border-line bg-surface-sunken p-3"
                data-testid="prelim-justification-display"
              >
                <p className="text-caption text-ink-3">
                  受講者の事前理由記述（Mandatory Justification）:
                </p>
                <p className="border-l-2 border-l-line-strong pl-2 text-caption text-ink">
                  &quot;{prelimJustification}&quot;
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Rationale & Feedback */}
      <div className="space-y-block">
        <Card title="判定根拠（Evidence Summary）">
          <p className="text-caption text-ink-2">{evaluation.evidenceSummary}</p>
        </Card>

        <Card title="形成的診断アドバイス（Diagnostic Feedback）">
          <p className="text-caption text-ink-2">{evaluation.diagnosticFeedback}</p>
        </Card>

        {evaluation.probeConsistency && (
          <div data-testid="probe-consistency-block">
            <Card title="深掘りへの応答の一貫性（Probe Consistency）">
              {evaluation.probeConsistency.score === null ? (
                <p className="text-caption text-ink-2">
                  このセッションでは深掘り（ソクラテス型深掘り・What-if注入）が発生しなかったため、
                  判定対象がありません。
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-section text-ink" data-numeric>
                    {evaluation.probeConsistency.score.toFixed(2)}
                  </p>
                  <p className="text-caption text-ink-2">
                    {evaluation.probeConsistency.rationale}
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Dialogue Log with Evidence Highlights [根拠ハイライト] */}
      <Card
        title="対話ログ（根拠ハイライト付き）"
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-chip border border-accent/35 bg-accent/20" />
              仕込み不備・正常箇所に対応する検証行動
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-chip border border-line-strong bg-line-strong/50" />
              それ以外の一般的な検証行動
            </span>
          </span>
        }
      >
        <div className="max-h-96 space-y-cell overflow-y-auto pr-2">
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
                className={cn(
                  "flex flex-col",
                  msg.role === "user"
                    ? "items-end"
                    : msg.role === "mediator"
                      ? "items-center"
                      : "items-start",
                )}
              >
                <span className="mb-1 flex items-baseline gap-2 text-label text-ink-3">
                  <span>{speakerLabel}</span>
                  <span data-numeric>Turn {msg.turnSeq}</span>
                </span>
                <div
                  className={cn(
                    "max-w-[90%] whitespace-pre-wrap rounded-card border p-3 text-caption",
                    msg.role === "user"
                      ? "border-accent/40 bg-accent-wash text-ink"
                      : msg.role === "mediator"
                        ? "border-dashed border-line-strong bg-surface-sunken text-ink-2"
                        : "border-line bg-surface-sunken text-ink",
                  )}
                >
                  {renderChatContentWithHighlights(msg.content, turnComponents)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Evidence Components Highlight Spans */}
      <Card title="抽出された受講者の検証行動スパン（Stage 1 構造化出力）">
        <div className="space-y-row">
          {evaluation.evidenceComponents.map((comp, i) => (
            <div key={i} className="space-y-1.5 rounded-chip border border-line bg-surface-sunken p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-data font-semibold text-ink-2" data-numeric>
                  [Turn {comp.turn_index}] {comp.component_type}
                </span>
                {comp.injected_flaw_id && <Badge tone="accent">Match: {comp.injected_flaw_id}</Badge>}
              </div>
              <p className="rounded-chip border border-line bg-surface p-2 font-mono text-data leading-relaxed text-ink">
                &quot;{comp.quoted_span}&quot;
              </p>
              <p className="text-caption text-ink-2">{comp.rationale_summary}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Score Feedback & Dispute Section [MVP 4.5] */}
      <Card title="評点に対する異議申立・フィードバック（MVP 4.5 準拠）">
        {disputeSubmitted ? (
          <p className="rounded-chip border border-positive/25 bg-positive-wash p-3 text-caption text-positive">
            異議申立が `score_feedback` テーブルへ記録されました。SME評価者による再検証対象となります。
          </p>
        ) : (
          <div className="space-y-row">
            <fieldset className="space-y-1.5">
              <legend className="text-caption text-ink-2">どこが違うと考えますか（必須）</legend>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {DISAGREEMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-chip border px-3 py-2 text-caption transition-colors",
                      disputeDirection === opt.value
                        ? "border-accent bg-accent-wash text-ink"
                        : "border-line bg-surface text-ink-2 hover:border-line-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="disagreement_direction"
                      value={opt.value}
                      checked={disputeDirection === opt.value}
                      onChange={(e) => setDisputeDirection(e.target.value)}
                      className="accent-[var(--color-accent)]"
                    />
                    <span>{opt.label}</span>
                    <span className="ml-auto font-mono text-data text-ink-3">{opt.value}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <textarea
              aria-label="異議の理由"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="「ターン3で触れたフォールバック要件の指摘が反映されていません」など、異議の理由を具体的に記述してください（必須）…"
              className={cn(
                "h-20 w-full resize-none rounded-chip border border-line-strong bg-surface p-3",
                "text-caption text-ink focus:border-accent focus:outline-none",
              )}
            />
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={onSubmitDispute}
                disabled={!disputeReason.trim() || !disputeDirection}
              >
                異議を申し立てる（記録）
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Debriefing & Benchmark Gallery Link */}
      {onViewBenchmarkGallery && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-card border border-line bg-surface-sunken p-4 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <p className="text-section text-ink">
              このシナリオのエキスパート事後講評（デブリーフィング）を見る
            </p>
            <p className="text-caption text-ink-2">
              AIトラップ構造の解剖、上位者の攻略ルート、動的コンピテンシー別の客観的行動と自身の伸び代を振り返ることができます。
            </p>
          </div>
          <Button variant="primary" onClick={onViewBenchmarkGallery} className="shrink-0">
            事後講評を開く
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <Button variant="quiet" onClick={onResetToInit}>
          ← トップへ戻り最初からやり直す
        </Button>
        <span className="text-caption text-ink-2">W1〜W5 全フロー縦切り動作完了</span>
      </div>
    </div>
  );
}
