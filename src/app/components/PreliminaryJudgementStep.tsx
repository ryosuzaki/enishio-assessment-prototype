"use client";

import React, { useMemo } from "react";
import {
  FileCheck,
  AlertCircle,
  RefreshCw,
  Award,
  Bot,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Quote,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import type { ChatMessage } from "../types";

interface PreliminaryJudgementStepProps {
  taskId?: string;
  chatHistory?: ChatMessage[];
  prelimAction: "approve" | "remand" | "comment" | "";
  setPrelimAction: (action: "approve" | "remand" | "comment" | "") => void;
  prelimJustification: string;
  setPrelimJustification: (justification: string) => void;
  prelimError: string | null;
  isEvaluating: boolean;
  onBackToDialogue: () => void;
  onConfirmPreliminaryAndEvaluate: () => void;
}

export function PreliminaryJudgementStep({
  taskId = "TASK-FINTECH-AUTH-01",
  chatHistory = [],
  prelimAction,
  setPrelimAction,
  prelimJustification,
  setPrelimJustification,
  prelimError,
  isEvaluating,
  onBackToDialogue,
  onConfirmPreliminaryAndEvaluate,
}: PreliminaryJudgementStepProps) {
  // Extract user quotes from dialogue
  const userQuotes = useMemo(() => {
    return chatHistory
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .slice(-3);
  }, [chatHistory]);

  // Dynamically synthesize points actually raised by the learner [D-80] (No spoilers of unmentioned flaws)
  const synthesizedPoints = useMemo(() => {
    const userMessages = chatHistory.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      return [];
    }
    return userMessages.map((msg, idx) => {
      const content = msg.content.trim();
      const firstLine = content.split("\n")[0];
      const title = firstLine.length > 50 ? firstLine.slice(0, 50) + "…" : firstLine;
      const turnSeq = msg.turnSeq ?? (idx + 1) * 2 - 1;
      return {
        num: `指摘 #${idx + 1}`,
        turnSeq,
        title,
        detail: content,
      };
    });
  }, [chatHistory]);

  return (
    <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <GitPullRequest className="w-6 h-6 text-indigo-400" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                CFF: Force Decision First & Mandatory Justification (進行役ミラーリング [D-80])
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> 白紙再作文の恒久禁止
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              成果物の最終判定と判断理由の言語化（進行役論点要約・GitHub PRレビュー形式）
            </h2>
          </div>
        </div>
      </div>

      {/* Explanation Banner */}
      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
        AIによる自動採点およびXAIレポートを開示する前に、受講者自身の最終判定をコミットさせます（Force Decision First）。
        <strong>白紙textareaへの長文再作文は恒久的に廃止されました（[D-80]）。</strong>
        進行役が対話ログから整理した以下の論点要約を確認し、GitHub PRレビュー形式で［承認］［条件付き承認］［差し戻し］の意思決定をワンクリックで確定してください。
      </p>

      {prelimError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{prelimError}</span>
        </div>
      )}

      {/* Mirroring Synthesis Card */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/30 space-y-3 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span>進行役（メディエーター）による対話論点のミラーリング要約</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            ※ 対話ログから受講者の主張を抽出・整理済み（先回り正答開示なし）
          </span>
        </div>

        <div className="space-y-2">
          {synthesizedPoints.length > 0 ? (
            synthesizedPoints.map((pt) => (
              <div
                key={pt.num}
                className="flex items-start gap-2.5 text-xs text-slate-200 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60"
              >
                <span className="font-bold text-indigo-400 shrink-0 font-mono text-[11px] bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                  {pt.num} (Turn {pt.turnSeq})
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-100">{pt.title}: </span>
                  <span className="text-slate-300">{pt.detail}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400 bg-slate-900/40 p-3 rounded-lg border border-slate-800/60 italic">
              ※ 対話ログに受講者からの指摘・指示発言が記録されていません。対話を経ずに判断に進む場合は、以下の「判断理由（必須）」欄に成果物に対する具体的な理由を直接記述してください。
            </div>
          )}
        </div>

        {userQuotes.length > 0 && (
          <div className="pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1">
              <Quote className="w-3 h-3 text-slate-400" />
              <span>受講者の主要な対話発言（引用スパン）:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {userQuotes.map((q, idx) => (
                <span
                  key={idx}
                  className="text-[11px] text-slate-300 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 italic"
                >
                  &ldquo;{q.length > 50 ? q.slice(0, 50) + "…" : q}&rdquo;
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 1. GitHub PR Review Decision Action */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block flex items-center justify-between">
          <span>① このプルリクエストに対する最終意思決定（GitHub PRレビュー形式・必須）</span>
          <span className="text-indigo-400 text-[10px] font-normal">※ 選択するだけでワンクリック確定可能</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              prelimAction === "remand"
                ? "bg-amber-600/15 border-amber-500 text-white shadow-lg shadow-amber-500/10"
                : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <input
              type="radio"
              name="prelim_action"
              value="remand"
              checked={prelimAction === "remand"}
              onChange={() => setPrelimAction("remand")}
              className="mt-1 text-amber-600 focus:ring-0"
            />
            <div>
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> ⚠️ 修正を要求 (Request Changes)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                重大な障害リスクや規程違反（P0ブロッカー）が残っており、本番リリース不可と判定。修正を指示。
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              prelimAction === "comment"
                ? "bg-sky-600/15 border-sky-500 text-white shadow-lg shadow-sky-500/10"
                : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <input
              type="radio"
              name="prelim_action"
              value="comment"
              checked={prelimAction === "comment"}
              onChange={() => setPrelimAction("comment")}
              className="mt-1 text-sky-600 focus:ring-0"
            />
            <div>
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> 💬 条件付きで進める (Comment)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                主要設計には合意。ステージング環境での追加検証や運用監視（アラート設定）の追加を条件として許可。
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              prelimAction === "approve"
                ? "bg-emerald-600/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10"
                : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <input
              type="radio"
              name="prelim_action"
              value="approve"
              checked={prelimAction === "approve"}
              onChange={() => setPrelimAction("approve")}
              className="mt-1 text-emerald-600 focus:ring-0"
            />
            <div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> ✅ 承認する (Approve)
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                要件およびチーム運用基準を満たしており、このまま本番デプロイ可能と判定。
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Optional Adjustment & Notes (White-space essay is permanently forbidden [D-80]) */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block flex items-center justify-between">
          <span>② 進行役の要約に対する補足・微調整（任意・省略可）</span>
          <span className="text-slate-400 text-[10px] font-mono">※ 省略時は上記要約がそのまま記録されます</span>
        </label>
        <textarea
          value={prelimJustification}
          onChange={(e) => setPrelimJustification(e.target.value)}
          placeholder="進行役の要約に補足や微調整がある場合のみ入力してください（省略可。例: 承認または差し戻しと判断した具体的な根拠・理由を記述）"
          className="w-full bg-slate-950 text-xs text-slate-100 p-3 rounded-xl border border-slate-800 h-20 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
        />
        <p className="text-[11px] text-slate-400">
          ※ 白紙からの再作文は不要です。入力がない場合も、進行役がまとめた論点要約がそのまま正式な判断理由（Mandatory Justification）として安全に記録されます。
        </p>
      </div>

      {/* Action Footers */}
      <div className="pt-4 flex justify-between items-center border-t border-slate-800">
        <button
          onClick={onBackToDialogue}
          disabled={isEvaluating}
          className="text-xs text-slate-400 hover:text-slate-200 underline"
        >
          ← 対話画面へ戻る
        </button>
        <button
          onClick={onConfirmPreliminaryAndEvaluate}
          disabled={isEvaluating || !prelimAction}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-40 cursor-pointer"
        >
          {isEvaluating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              評価実行中（Stage 1 抽出 ➔ Stage 2 採点）...
            </>
          ) : (
            <>
              暫定判断を確定し、AI評価を実行する
              <Award className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * [D-80]: 白紙再作文を行わない場合のフォールバック論点要約テキスト生成
 * 進行役がまとめた対話論点＋受講者発言引用を統合し、DB記録用の理由テキストとして返す（事前ネタバレ排除）
 */
export function getDefaultMirroringSummary(
  taskId: string = "",
  chatHistory: ChatMessage[] = []
): string {
  const userMessages = chatHistory.filter((m) => m.role === "user");
  if (userMessages.length === 0) {
    return "対話ログに基づく受講者判定（直接確定）";
  }

  const quotes = userMessages
    .map((m) => m.content.trim())
    .filter(Boolean)
    .slice(-3);

  const quotesStr = quotes.map((q) => `「${q.length > 50 ? q.slice(0, 50) + "…" : q}」`).join("、");
  return `【進行役対話要約】受講者の対話発言・指摘事項（${quotesStr}）を踏まえた最終コミットメント。`;
}
