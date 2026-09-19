"use client";

import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import type { DynamicTaskScenario } from "@/data/dynamic-task";
import type { ChatMessage, EvidenceTargetState, FocusItem, ProbeMove, PremiseShiftState } from "../types";
import { MAX_PROBES_PER_SESSION } from "../types";
import { MediationStatePanel } from "./MediationStatePanel";
import { Badge, Button, cn } from "./ui";

/**
 * 手動での前提変化注入を出してよいビルドか。`next build` 済みの本番ビルドでは false になり、
 * このフラグを見ているブロックはバンドルから落ちる。サーバ側（/api/dialogue/premise-shift）も
 * 同じ条件で force を無視するため、受講者が撃てないという保証は片側だけでは破れない `[D-100]`。
 */
const IS_DEV_BUILD = process.env.NODE_ENV !== "production";

/** 運用コンテキスト文書の出自。絵文字ではなく語で示す。 */
const DOC_TYPE_LABEL: Record<string, string> = {
  slack: "Slack",
  incident: "障害報告",
};

interface DialogueSessionStepProps {
  selectedTask: DynamicTaskScenario;
  artifactCode: string;
  setArtifactCode: (code: string) => void;
  focusItems: FocusItem[];
  focusInputText: string;
  setFocusInputText: (text: string) => void;
  chatHistory: ChatMessage[];
  turnCounter: number;
  userPromptInput: string;
  setUserPromptInput: (input: string) => void;
  cffActiveWarning: string | null;
  isSubmitting: boolean;
  mediationStateEstimate: EvidenceTargetState[] | null;
  lastProbeMove: ProbeMove | null;
  lastSelectionRationale: string | null;
  probesIssued: number;
  isProbing: boolean;
  premiseShiftState?: PremiseShiftState;
  /**
   * 開発ビルド限定の手動発火。**受講者UIには出さない** `[D-100]` ——
   * 前提変化は進行役側が対話ログから決定論的に撃つものであり、受講者が撃つ時点を
   * 選べるなら「不意の前提変化への適応」を測っていることにならない。
   */
  onForcePremiseShiftForDebug?: () => void;
  onProceedToPreliminaryJudgement: () => void;
  onAddFocusItem: (textSnippet?: string, noteText?: string) => void;
  onRemoveFocusItem: (seq: number) => void;
  onSendDialogueTurn: () => void;
}

/** ペインの器。3枚が同じ高さで並ぶ前提の縦積みレイアウトを持つ。 */
function Pane({
  title,
  meta,
  className,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex h-[520px] min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-3.5",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line pb-2">
        <h2 className="truncate text-section text-ink">{title}</h2>
        {meta}
      </header>
      {children}
    </section>
  );
}

export function DialogueSessionStep({
  selectedTask,
  artifactCode,
  setArtifactCode,
  focusItems,
  focusInputText,
  setFocusInputText,
  chatHistory,
  turnCounter,
  userPromptInput,
  setUserPromptInput,
  cffActiveWarning,
  isSubmitting,
  mediationStateEstimate,
  lastProbeMove,
  lastSelectionRationale,
  probesIssued,
  isProbing,
  premiseShiftState,
  onForcePremiseShiftForDebug,
  onProceedToPreliminaryJudgement,
  onAddFocusItem,
  onRemoveFocusItem,
  onSendDialogueTurn,
}: DialogueSessionStepProps) {
  const [leftTab, setLeftTab] = useState<"requirements" | "context">("requirements");
  const [codeTab, setCodeTab] = useState<"impl" | "test">("impl");

  return (
    <div className="space-y-block">
      {/* Task Header */}
      <div className="flex flex-col items-start justify-between gap-4 border-b border-line pb-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-caption text-ink-3">動的課題: {selectedTask.task_id}</p>
          <h2 className="break-keep text-title leading-snug text-ink sm:text-title">
            {selectedTask.title}
          </h2>
        </div>
        <Button
          variant="primary"
          onClick={onProceedToPreliminaryJudgement}
          className="shrink-0 whitespace-nowrap text-caption"
        >
          レビュー完了 ➔ 暫定判断へ進む
        </Button>
      </div>

      {/* 場面3：前提変化（緊急仕様変更）バナー。発火は進行役側（/api/dialogue/premise-shift） */}
      {premiseShiftState?.isInjected ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-card border border-caution/40 bg-caution-wash p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="caution">場面3：前提変化（緊急仕様変更 発生中）</Badge>
              <span className="text-section text-ink">
                緊急仕様変更・追加要件が通知されました
              </span>
              <span className="text-caption text-ink-3" data-numeric>
                Turn #{premiseShiftState.injectedAtTurn ?? 2} 注入
              </span>
            </div>
            <h3 className="text-section text-ink">{premiseShiftState.title}</h3>
            <p className="text-caption text-ink-2">{premiseShiftState.announcement}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-caption text-ink-2">適応行動・方針更新を観測中</span>
        </div>
      ) : IS_DEV_BUILD && selectedTask.premise_shift ? (
        /*
         * 開発ビルドにだけ出る手動発火。**受講者の画面に出してはならない** `[D-100]`。
         * 「これから前提が変わる」と予告した時点で不意打ちではなくなり、撃たない自由が
         * あれば領域4の証拠が取れたセッションと取れないセッションが混在する。
         * 本番ビルドではこのブロックごと出ず、サーバ側も force を無視する。
         */
        <div className="flex flex-col items-start justify-between gap-3 rounded-card border border-dashed border-line-strong bg-surface-sunken p-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <p className="text-section text-ink-2">DEV ONLY — 本番ビルドでは表示されない</p>
            <p className="text-caption text-ink-2">
              場面3の前提変化は通常、進行役が対話ログから自動で注入する。これは開発・E2E用の手動発火。
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={onForcePremiseShiftForDebug}
            data-testid="debug-force-premise-shift"
            className="shrink-0 whitespace-nowrap text-caption"
          >
            [dev] 前提変化を手動注入
          </Button>
        </div>
      ) : null}

      {/* 3-Pane Layout Grid (Left: Requirements / Middle: Artifact / Right: Verification Panel) */}
      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        {/* Left Pane (1): Scenario & Requirements with Sub-tabs */}
        <Pane title="【第1ペイン】開発Issue ＆ チーム情報" className="w-full shrink-0 lg:w-[28%]">
          <div className="flex shrink-0 border-b border-line">
            <button
              onClick={() => setLeftTab("requirements")}
              className={cn(
                "flex-1 border-b-2 py-1.5 text-label transition-colors",
                leftTab === "requirements"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              開発Issue
            </button>
            <button
              onClick={() => setLeftTab("context")}
              className={cn(
                "flex-1 border-b-2 py-1.5 text-label transition-colors",
                leftTab === "context"
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              運用コンテキスト
              {selectedTask.context_documents && (
                <span className="ml-1.5 text-ink-3" data-numeric>
                  {selectedTask.context_documents.length + (premiseShiftState?.isInjected ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {leftTab === "requirements" ? (
            <div className="flex-1 space-y-cell overflow-y-auto">
              <p className="text-caption text-ink-2">{selectedTask.scenario_intro}</p>
              <div className="space-y-1.5">
                <p className="text-caption text-ink-3">受入基準（Acceptance Criteria）:</p>
                {selectedTask.business_requirements.map((req, i) => (
                  <p
                    key={i}
                    className="rounded-chip border border-line bg-surface-sunken p-2.5 text-caption text-ink-2"
                  >
                    {req}
                  </p>
                ))}
                {premiseShiftState?.isInjected && selectedTask.premise_shift && (
                  <p className="rounded-chip border border-caution/40 bg-caution-wash p-2.5 text-section leading-relaxed text-ink">
                    {selectedTask.premise_shift.new_requirement}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-caption text-ink-3">非機能・運用目標:</p>
                {selectedTask.constraints.map((c, i) => (
                  <p
                    key={i}
                    className="rounded-chip border border-line bg-surface-sunken p-2.5 text-caption text-ink-2"
                  >
                    {c}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-row overflow-y-auto">
              <p className="text-caption text-ink-3">
                ※
                チーム内Slack、過去の障害報告書、社内規程メモです。散らばった情報から運用環境の前提を読み解いてください。
              </p>
              {premiseShiftState?.isInjected && selectedTask.premise_shift && (
                <article className="space-y-1.5 rounded-chip border border-caution/40 bg-caution-wash p-2.5">
                  <header className="flex items-center justify-between gap-2 border-b border-caution/25 pb-1">
                    <h3 className="truncate text-section text-ink">
                      {selectedTask.premise_shift.context_doc.title}
                    </h3>
                    <span className="shrink-0 text-caption text-ink-3" data-numeric>
                      {selectedTask.premise_shift.context_doc.timestamp}
                    </span>
                  </header>
                  <p className="whitespace-pre-wrap text-caption text-ink-2">
                    {selectedTask.premise_shift.context_doc.content}
                  </p>
                </article>
              )}
              {selectedTask.context_documents?.map((doc) => (
                <article
                  key={doc.id}
                  className="space-y-1.5 rounded-chip border border-line bg-surface-sunken p-2.5"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-line pb-1">
                    <h3 className="flex min-w-0 items-center gap-1.5">
                      {DOC_TYPE_LABEL[doc.type] && <Badge tone="neutral">{DOC_TYPE_LABEL[doc.type]}</Badge>}
                      <span className="truncate text-section text-ink">{doc.title}</span>
                    </h3>
                    <span className="shrink-0 text-caption text-ink-3" data-numeric>
                      {doc.timestamp}
                    </span>
                  </header>
                  <p className="whitespace-pre-wrap text-caption text-ink-2">{doc.content}</p>
                </article>
              ))}
            </div>
          )}
        </Pane>

        {/* Middle Pane (2): AI Artifact Code Editor & PR Description */}
        <Pane
          title="【第2ペイン】成果物ドラフト"
          meta={
            <span className="shrink-0 whitespace-nowrap text-caption text-ink-3">
              {codeTab === "impl" ? "Live Editor" : "Spec / Test View"}
            </span>
          }
          className="w-full lg:flex-1"
        >
          {/* PR Description Header Card */}
          {selectedTask.pr_description && (
            <div className="shrink-0 space-y-1.5 rounded-chip border border-line bg-surface-sunken p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-section text-ink">
                  {selectedTask.pr_description.title}
                </p>
                <span className="shrink-0 font-mono text-data text-ink-2">
                  {selectedTask.pr_description.branch}
                </span>
              </div>
              <p className="text-caption text-ink-2">{selectedTask.pr_description.summary}</p>
            </div>
          )}

          {/* File Switcher Tabs: Implementation vs Unit Test */}
          <div className="flex shrink-0 items-center gap-1.5 border-b border-line pb-1">
            <button
              onClick={() => setCodeTab("impl")}
              className={cn(
                "rounded-chip border px-3 py-1 text-caption transition-colors",
                codeTab === "impl"
                  ? "border-accent bg-accent-wash font-semibold text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              実装コード
            </button>
            {selectedTask.test_code && (
              <button
                onClick={() => setCodeTab("test")}
                className={cn(
                  "flex items-center gap-1.5 rounded-chip border px-3 py-1 text-caption transition-colors",
                  codeTab === "test"
                    ? "border-accent bg-accent-wash font-semibold text-ink"
                    : "border-transparent text-ink-3 hover:text-ink-2",
                )}
              >
                <span>テストコード (*.test.ts)</span>
                <Badge tone="neutral">Vitest</Badge>
              </button>
            )}
          </div>

          {codeTab === "impl" ? (
            <textarea
              aria-label="成果物ドラフトの実装コード"
              value={artifactCode}
              onChange={(e) => setArtifactCode(e.target.value)}
              className={cn(
                "min-h-0 w-full flex-1 resize-none overflow-x-auto whitespace-pre rounded-chip border border-line",
                "bg-surface-sunken p-3.5 font-mono text-data leading-relaxed text-ink focus:border-accent focus:outline-none",
              )}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
              <div className="flex shrink-0 items-center justify-between gap-2 rounded-chip border border-caution/25 bg-caution-wash px-3 py-1.5 text-caption text-ink-2">
                <span>
                  AI同僚が作成したユニットテストです。正常系以外のテストが網羅されているか精査してください。
                </span>
                <span className="shrink-0 font-mono text-data text-ink-2">All tests passed (3/3)</span>
              </div>
              <textarea
                aria-label="AI同僚が作成したテストコード"
                readOnly
                value={selectedTask.test_code}
                className={cn(
                  "min-h-0 w-full flex-1 select-text resize-none overflow-x-auto whitespace-pre rounded-chip",
                  "border border-line bg-surface-sunken p-3.5 font-mono text-data leading-relaxed text-ink-2 focus:outline-none",
                )}
              />
            </div>
          )}

          {/* Quick Focus Add Bar */}
          <div className="flex shrink-0 items-center gap-2 pt-1.5">
            <input
              type="text"
              value={focusInputText}
              onChange={(e) => setFocusInputText(e.target.value)}
              placeholder="検証対象とするコード断片・キーワード…"
              className={cn(
                "min-w-0 flex-1 rounded-chip border border-line-strong bg-surface px-2 py-1.5",
                "text-caption text-ink focus:border-accent focus:outline-none",
              )}
            />
            <Button
              variant="secondary"
              onClick={() => onAddFocusItem()}
              disabled={!focusInputText.trim()}
              className="shrink-0 whitespace-nowrap px-2.5 py-1.5 text-caption"
            >
              検証パネルへ追加
            </Button>
          </div>
        </Pane>

        {/* Right Pane (3): Verification Focus Panel [MVP 4.4, T-17b] */}
        <Pane
          title="【第3ペイン】検証パネル"
          meta={<span className="shrink-0 font-mono text-data text-ink-3">focus_seq</span>}
          className="w-full shrink-0 lg:w-[28%]"
        >
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {focusItems.length === 0 ? (
              <p className="flex h-full items-center justify-center p-4 text-center text-caption text-ink-3">
                成果物の確認箇所を選択・入力して「検証パネルへ追加」を押すと、検証順序がここに記録されます。
              </p>
            ) : (
              focusItems.map((item) => (
                <div
                  key={item.focusSeq}
                  className="space-y-1 rounded-chip border border-line bg-surface-sunken p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-data font-semibold text-ink-2"
                      data-testid="focus-item-seq"
                      data-numeric
                    >
                      #{item.focusSeq}
                    </span>
                    <button
                      onClick={() => onRemoveFocusItem(item.focusSeq)}
                      className="p-0.5 text-ink-3 transition-colors hover:text-critical"
                      title="削除" aria-label={`検証項目 #${item.focusSeq} を削除`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="break-words rounded-chip border border-line bg-surface p-2 font-mono text-data leading-relaxed text-ink">
                    {item.selectedText}
                  </p>
                </div>
              ))
            )}
          </div>

          <p className="shrink-0 border-t border-line pt-2 text-caption text-ink-3">
            ※ 選択箇所と順序は{" "}
            <code className="font-mono text-ink-2">verification_focus_sequence</code>{" "}
            ログとして保存されます（AI採点には入力されません）。
          </p>
        </Pane>
      </div>

      {/* Mediation State Panel (MVP 2.1 ステップ7・8) */}
      <MediationStatePanel
        stateEstimate={mediationStateEstimate}
        lastProbeMove={lastProbeMove}
        selectionRationale={lastSelectionRationale}
        probesIssued={probesIssued}
        maxProbes={MAX_PROBES_PER_SESSION}
        isProbing={isProbing}
      />

      {/* Chat & Prompt Dialogue Pane */}
      <section className="space-y-block rounded-card border border-line bg-surface p-5">
        <header className="flex items-center justify-between border-b border-line pb-2">
          <h2 className="text-section text-ink">AI同僚との対話・修正指示（マルチターン対話）</h2>
          <span className="text-caption text-ink-3" data-numeric>
            Turn #{turnCounter}
          </span>
        </header>

        {/* Chat Message List */}
        <div className="max-h-[380px] min-h-[220px] space-y-cell overflow-y-auto pr-2">
          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col",
                msg.role === "user" ? "items-end" : msg.role === "mediator" ? "items-center" : "items-start",
              )}
            >
              <span className="mb-1 text-caption text-ink-3">
                {msg.role === "user"
                  ? "You (受講者)"
                  : msg.role === "mediator"
                    ? "進行役（媒介プローブ）"
                    : "AI Peer (同僚エージェント)"}
              </span>
              <div
                className={cn(
                  "max-w-[85%] rounded-card border p-3 text-caption",
                  msg.role === "user"
                    ? "border-accent bg-accent text-white"
                    : msg.role === "mediator"
                      ? "border-dashed border-line-strong bg-surface-sunken text-ink-2"
                      : "border-line bg-surface-sunken text-ink",
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Intent-Action Gap Warning Toast if triggered */}
        {cffActiveWarning && (
          <div
            role="status"
            className="rounded-card border border-caution/30 bg-caution-wash p-3 text-caption text-caution"
          >
            {cffActiveWarning}
          </div>
        )}

        {/* Input Prompt Box */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={userPromptInput}
            onChange={(e) => setUserPromptInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isSubmitting && onSendDialogueTurn()}
            placeholder="AI同僚に指示・指摘を入力（例: JWT検証のみだと強制ログアウト時に無効化できないリスクがあります）…"
            className={cn(
              "flex-1 rounded-chip border border-line-strong bg-surface px-4 py-2.5",
              "text-caption text-ink focus:border-accent focus:outline-none",
            )}
          />
          <Button
            variant="primary"
            onClick={onSendDialogueTurn}
            disabled={isSubmitting || !userPromptInput.trim()}
          >
            送信
          </Button>
        </div>
      </section>
    </div>
  );
}
