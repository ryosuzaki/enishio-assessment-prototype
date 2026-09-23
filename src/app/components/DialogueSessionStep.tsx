"use client";

import React, { useState, useRef, useEffect } from "react";
import { Quote } from "lucide-react";
import type { DynamicTaskScenario } from "@/data/dynamic-task";
import type { ChatMessage, PremiseShiftState } from "../types";
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
  chatHistory: ChatMessage[];
  turnCounter: number;
  userPromptInput: string;
  setUserPromptInput: React.Dispatch<React.SetStateAction<string>> | ((input: string) => void);
  cffActiveWarning: string | null;
  isSubmitting: boolean;
  premiseShiftState?: PremiseShiftState;
  onForcePremiseShiftForDebug?: () => void;
  onProceedToPreliminaryJudgement: () => void;
  onSendDialogueTurn: () => void;
}

/** ペインの器。2枚が並ぶ縦積みレイアウトを持つ。 */
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
  chatHistory,
  turnCounter,
  userPromptInput,
  setUserPromptInput,
  cffActiveWarning,
  isSubmitting,
  premiseShiftState,
  onForcePremiseShiftForDebug,
  onProceedToPreliminaryJudgement,
  onSendDialogueTurn,
}: DialogueSessionStepProps) {
  const [leftTab, setLeftTab] = useState<"requirements" | "context">("requirements");
  const [codeTab, setCodeTab] = useState<"impl" | "test">("impl");
  const [quoteNotice, setQuoteNotice] = useState<string | null>(null);
  const [leftQuoteNotice, setLeftQuoteNotice] = useState<string | null>(null);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);

  const implTextareaRef = useRef<HTMLTextAreaElement>(null);
  const testTextareaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  /** 選択された要件・コンテキスト文章をチャット入力欄に Markdown 引用形式で挿入 */
  const handleQuoteRequirement = () => {
    let selectedText = "";
    if (typeof window !== "undefined") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        selectedText = selection.toString().trim();
      }
    }

    if (!selectedText) {
      setLeftQuoteNotice("要件またはコンテキストの文字列を選択してから押してください");
      setTimeout(() => setLeftQuoteNotice(null), 3000);
      return;
    }

    const formattedQuote = `> ${selectedText.split("\n").map((line) => line.trim()).filter(Boolean).join("\n> ")}\n\n`;
    const nextPrompt = userPromptInput ? `${userPromptInput}\n${formattedQuote}` : formattedQuote;
    setUserPromptInput(nextPrompt);
    setLeftQuoteNotice("要件テキストをチャット欄に引用しました");
    setTimeout(() => setLeftQuoteNotice(null), 2500);

    promptInputRef.current?.focus();
  };

  /** 選択されたコード行をチャット入力欄に Markdown 引用形式で挿入 */
  const handleQuoteCode = () => {
    const textarea = codeTab === "impl" ? implTextareaRef.current : testTextareaRef.current;
    let selectedText = "";
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd).trim();
    }

    if (!selectedText) {
      setQuoteNotice("エディタ内のコード行を選択してから押してください");
      setTimeout(() => setQuoteNotice(null), 3000);
      return;
    }

    const formattedQuote = `> ${selectedText.split("\n").join("\n> ")}\n\n`;
    const nextPrompt = userPromptInput ? `${userPromptInput}\n${formattedQuote}` : formattedQuote;
    setUserPromptInput(nextPrompt);
    setQuoteNotice("コードをチャット欄に引用しました");
    setTimeout(() => setQuoteNotice(null), 2500);

    promptInputRef.current?.focus();
  };

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
              <Badge tone="caution">場面3：前提変化</Badge>
              <span className="text-section text-ink">
                緊急仕様変更・追加要件が通知されました
              </span>
              <span className="text-caption text-ink-3" data-numeric>
                ターン {premiseShiftState.injectedAtTurn ?? 2} で通知
              </span>
            </div>
            <h3 className="text-section text-ink">{premiseShiftState.title}</h3>
            <p className="text-caption text-ink-2">{premiseShiftState.announcement}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-caption text-ink-2">方針の組み直しを観測中</span>
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

      {/* 2-Pane Layout Grid (Left: Requirements & Context / Right: Artifact & Code Editor) */}
      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        {/* Left Pane (1): Scenario & Requirements with Sub-tabs */}
        <Pane title="【第1ペイン】開発Issue ＆ チーム情報" className="w-full shrink-0 lg:w-[38%]">
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

          {/* Requirement / Context Quoting Bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-caption">
            <span className="text-caption text-ink-3">
              {leftQuoteNotice ? (
                <span className="font-semibold text-accent">{leftQuoteNotice}</span>
              ) : (
                "要件・本文を選択して「チャットに引用」を押すと挿入されます"
              )}
            </span>
            <Button
              type="button"
              variant="secondary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleQuoteRequirement}
              data-testid="quote-requirement-btn"
              className="shrink-0 whitespace-nowrap px-3 py-1.5 text-caption"
            >
              <Quote className="mr-1.5 h-3.5 w-3.5" />
              選択箇所をチャットに引用
            </Button>
          </div>
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
              ref={implTextareaRef}
              data-testid="draft-code-editor"
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
                ref={testTextareaRef}
                data-testid="test-code-editor"
                aria-label="AI同僚が作成したテストコード"
                readOnly
                value={selectedTask.test_code}
                className={cn(
                  "min-h-0 w-full flex-1 resize-none overflow-x-auto whitespace-pre rounded-chip border border-line",
                  "bg-surface-sunken p-3.5 font-mono text-data leading-relaxed text-ink focus:border-accent focus:outline-none",
                )}
              />
            </div>
          )}

          {/* Code Quoting Bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-caption">
            <span className="text-caption text-ink-3">
              {quoteNotice ? (
                <span className="font-semibold text-accent">{quoteNotice}</span>
              ) : (
                "コードを選択して「チャットに引用」を押すと、下の指示欄に挿入されます"
              )}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={handleQuoteCode}
              data-testid="quote-code-btn"
              className="shrink-0 whitespace-nowrap px-3 py-1.5 text-caption"
            >
              <Quote className="mr-1.5 h-3.5 w-3.5" />
              選択コードをチャットに引用
            </Button>
          </div>
        </Pane>
      </div>

      {/* Chat & Prompt Dialogue Pane */}
      <section className="space-y-block rounded-card border border-line bg-surface p-5">
        <header className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-section text-ink">AI同僚との対話・修正指示（マルチターン対話）</h2>
            <button
              type="button"
              onClick={() => setIsChatExpanded(!isChatExpanded)}
              className="rounded-chip border border-line px-2 py-0.5 text-label text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            >
              {isChatExpanded ? "標準の高さに戻す" : "縦幅をさらに広げる"}
            </button>
          </div>
          <span className="text-caption text-ink-3" data-numeric>
            ターン {turnCounter}
          </span>
        </header>

        {/* Chat Message List */}
        <div
          className={cn(
            "space-y-cell overflow-y-auto pr-2 transition-all duration-150",
            isChatExpanded ? "min-h-[600px] max-h-[850px]" : "min-h-[440px] max-h-[660px]",
          )}
        >
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
                  ? "あなた（受講者）"
                  : msg.role === "mediator"
                    ? "進行役（深掘り）"
                    : "AI同僚"}
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
          <div ref={chatEndRef} />
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
        <div className="flex items-end gap-2 pt-1">
          <textarea
            ref={promptInputRef}
            rows={3}
            value={userPromptInput}
            onChange={(e) => setUserPromptInput(e.target.value)}
            onKeyDown={(e) => {
              // 日本語IME変換中のEnter確定による誤送信を防止する（RV-J3）
              if (e.nativeEvent.isComposing || e.key === "Process") return;
              if (e.key === "Enter" && !e.shiftKey && !isSubmitting && userPromptInput.trim()) {
                e.preventDefault();
                onSendDialogueTurn();
              }
            }}
            aria-label="AI同僚への指示・指摘入力"
            placeholder="AI同僚に指示・指摘を入力（Enterで送信、Shift+Enterで改行。コード引用対応）…"
            className={cn(
              "min-h-[76px] flex-1 resize-y rounded-chip border border-line-strong bg-surface px-4 py-2.5",
              "text-caption text-ink focus:border-accent focus:outline-none",
            )}
          />
          <Button
            variant="primary"
            onClick={onSendDialogueTurn}
            disabled={isSubmitting || !userPromptInput.trim()}
            className="h-[44px]"
          >
            送信
          </Button>
        </div>
      </section>
    </div>
  );
}
