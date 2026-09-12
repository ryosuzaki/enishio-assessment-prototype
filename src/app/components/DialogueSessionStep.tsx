"use client";

import React, { useState } from "react";
import {
  Layers,
  ArrowRight,
  FileText,
  Code,
  Eye,
  Plus,
  Trash2,
  CheckSquare,
  MessageSquare,
  AlertCircle,
  Send,
  GitPullRequest,
  FlaskConical,
} from "lucide-react";
import type { DynamicTaskScenario } from "@/data/dynamic-task";
import type { ChatMessage, EvidenceTargetState, FocusItem, ProbeMove } from "../types";
import { MAX_PROBES_PER_SESSION } from "../types";
import { MediationStatePanel } from "./MediationStatePanel";

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
  onProceedToPreliminaryJudgement: () => void;
  onAddFocusItem: (textSnippet?: string, noteText?: string) => void;
  onRemoveFocusItem: (seq: number) => void;
  onSendDialogueTurn: () => void;
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
  onProceedToPreliminaryJudgement,
  onAddFocusItem,
  onRemoveFocusItem,
  onSendDialogueTurn,
}: DialogueSessionStepProps) {
  const [leftTab, setLeftTab] = useState<"requirements" | "context">("requirements");
  const [codeTab, setCodeTab] = useState<"impl" | "test">("impl");

  return (
    <div className="space-y-6">
      {/* Task Header */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-blue-400 mb-1 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" /> 動的課題: {selectedTask.task_id}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white break-keep leading-snug">{selectedTask.title}</h2>
        </div>
        <button
          onClick={onProceedToPreliminaryJudgement}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/20 shrink-0 whitespace-nowrap"
        >
          レビュー完了 ➔ 暫定判断へ進む
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 3-Pane Layout Grid (Left: Requirements / Middle: Artifact / Right: Verification Panel) */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* Left Pane (1): Scenario & Requirements with Sub-tabs */}
        <div className="w-full lg:w-[28%] glass-panel p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 flex flex-col h-[520px] overflow-y-auto min-w-0 shrink-0">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>【第1ペイン】業務要件と制約条件</span>
            </div>
          </div>

          {/* Sub-tabs: Requirements vs Context Documents */}
          <div className="flex border-b border-slate-800 shrink-0">
            <button
              onClick={() => setLeftTab("requirements")}
              className={`flex-1 py-1.5 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                leftTab === "requirements"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3 h-3" />
              要件・制約
            </button>
            <button
              onClick={() => setLeftTab("context")}
              className={`flex-1 py-1.5 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                leftTab === "context"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3 h-3 text-indigo-400" />
              関連Slack・経緯
              {selectedTask.context_documents && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  {selectedTask.context_documents.length}
                </span>
              )}
            </button>
          </div>

          {leftTab === "requirements" ? (
            <div className="space-y-3 flex-1 overflow-y-auto">
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedTask.scenario_intro}
              </p>
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400">必須要件:</span>
                {selectedTask.business_requirements.map((req, i) => (
                  <div key={i} className="text-xs text-slate-300 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                    {req}
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-amber-400">制約・セキュリティ基準:</span>
                {selectedTask.constraints.map((c, i) => (
                  <div key={i} className="text-xs text-amber-200/90 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30 leading-relaxed">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 flex-1 overflow-y-auto">
              <div className="text-[10px] text-slate-400 italic">
                ※ 関連チャンネルのやり取りや障害報告メモです。散らばった情報から暗黙の前提や経緯を読み解いてください。
              </div>
              {selectedTask.context_documents?.map((doc) => (
                <div key={doc.id} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                    <span className="font-bold text-indigo-300 text-[11px] flex items-center gap-1">
                      {doc.type === "slack" ? "💬" : doc.type === "incident" ? "🚨" : "📄"} {doc.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{doc.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed whitespace-pre-wrap">
                    {doc.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Middle Pane (2): AI Artifact Code Editor & PR Description */}
        <div className="w-full lg:flex-1 glass-panel p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 flex flex-col h-[520px] min-w-0">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Code className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>【第2ペイン】成果物ドラフト</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
              {codeTab === "impl" ? "Live Editor" : "Spec / Test View"}
            </span>
          </div>

          {/* PR Description Header Card */}
          {selectedTask.pr_description && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-200 truncate">
                  <GitPullRequest className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{selectedTask.pr_description.title}</span>
                </div>
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40 shrink-0">
                  {selectedTask.pr_description.branch}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {selectedTask.pr_description.summary}
              </p>
            </div>
          )}

          {/* File Switcher Tabs: Implementation vs Unit Test */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCodeTab("impl")}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                  codeTab === "impl"
                    ? "bg-slate-800 text-emerald-300 border-emerald-500/40 font-bold shadow-sm"
                    : "bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200"
                }`}
              >
                <Code className="w-3.5 h-3.5 text-emerald-400" />
                <span>実装コード</span>
              </button>
              {selectedTask.test_code && (
                <button
                  onClick={() => setCodeTab("test")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                    codeTab === "test"
                      ? "bg-slate-800 text-amber-300 border-amber-500/40 font-bold shadow-sm"
                      : "bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200"
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                  <span>テストコード (*.test.ts)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Vitest
                  </span>
                </button>
              )}
            </div>
          </div>

          {codeTab === "impl" ? (
            <textarea
              value={artifactCode}
              onChange={(e) => setArtifactCode(e.target.value)}
              className="w-full flex-1 bg-slate-900/90 font-mono text-xs leading-relaxed text-slate-200 p-3.5 rounded-lg border border-slate-800 resize-none focus:outline-none focus:border-blue-500 overflow-x-auto whitespace-pre min-h-0"
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0 space-y-1.5">
              <div className="text-[11px] text-amber-200/90 bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-900/40 flex items-center justify-between shrink-0">
                <span>⚠️ AI同僚が作成したユニットテストです。正常系以外のテストが網羅されているか精査してください。</span>
                <span className="font-mono text-[10px] text-amber-300 shrink-0">All tests passed (3/3)</span>
              </div>
              <textarea
                readOnly
                value={selectedTask.test_code}
                className="w-full flex-1 bg-slate-900/90 font-mono text-xs leading-relaxed text-slate-300 p-3.5 rounded-lg border border-slate-800 resize-none focus:outline-none overflow-x-auto whitespace-pre min-h-0 select-text"
              />
            </div>
          )}

          {/* Quick Focus Add Bar */}
          <div className="pt-1.5 flex gap-2 items-center shrink-0">
            <input
              type="text"
              value={focusInputText}
              onChange={(e) => setFocusInputText(e.target.value)}
              placeholder="検証対象とするコード断片・キーワード"
              className="flex-1 min-w-0 bg-slate-900 text-xs text-slate-200 px-2 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 placeholder:text-[10px] placeholder:text-slate-500"
            />
            <button
              onClick={() => onAddFocusItem()}
              disabled={!focusInputText.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all disabled:opacity-40 flex items-center gap-1 shrink-0 whitespace-nowrap shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              検証パネルへ追加
            </button>
          </div>
        </div>

        {/* Right Pane (3): Verification Focus Panel [MVP 4.4, T-17b] */}
        <div className="w-full lg:w-[28%] glass-panel p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 flex flex-col h-[520px] min-w-0 shrink-0">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0 gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 shrink-0">
              <Eye className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>【第3ペイン】検証パネル</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0 whitespace-nowrap">
              focus_seq
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {focusItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
                <CheckSquare className="w-8 h-8 mb-2 opacity-30" />
                <p>成果物の確認箇所を選択・入力して「検証パネルへ追加」を押すと、検証順序がここに記録されます。</p>
              </div>
            ) : (
              focusItems.map((item) => (
                <div
                  key={item.focusSeq}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                      #{item.focusSeq}
                    </span>
                    <button
                      onClick={() => onRemoveFocusItem(item.focusSeq)}
                      className="text-slate-500 hover:text-red-400 p-0.5 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800/80 break-words leading-relaxed">
                    {item.selectedText}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 leading-tight shrink-0">
            ※ 選択箇所と順序は <code className="text-purple-400">verification_focus_sequence</code> ログとして保存されます（AI採点には入力されません）。
          </div>
        </div>
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
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            AI同僚との対話・修正指示（マルチターン対話）
          </div>
          <span className="text-[10px] font-mono text-slate-400">Turn #{turnCounter}</span>
        </div>

        {/* Chat Message List */}
        <div className="space-y-3 min-h-[220px] max-h-[380px] overflow-y-auto pr-2">
          {chatHistory.map((msg, i) => (
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
                {msg.role === "user"
                  ? "You (受講者)"
                  : msg.role === "mediator"
                    ? "進行役（媒介プローブ）"
                    : "AI Peer (同僚エージェント)"}
              </div>
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : msg.role === "mediator"
                      ? "bg-cyan-950/50 text-cyan-100 border border-cyan-800/60 italic"
                      : "bg-slate-800/90 text-slate-100 rounded-tl-sm border border-slate-700/60"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Intent-Action Gap Warning Toast if triggered */}
        {cffActiveWarning && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{cffActiveWarning}</div>
          </div>
        )}

        {/* Input Prompt Box */}
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={userPromptInput}
            onChange={(e) => setUserPromptInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isSubmitting && onSendDialogueTurn()}
            placeholder="AI同僚に指示・指摘を入力（例: JWT検証のみだと強制ログアウト時に無効化できないリスクがあります）"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={onSendDialogueTurn}
            disabled={isSubmitting || !userPromptInput.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-all disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
