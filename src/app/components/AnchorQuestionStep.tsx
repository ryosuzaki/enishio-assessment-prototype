"use client";

import React from "react";
import { Clock, ArrowRight, MessageSquare, HelpCircle, CheckCircle2, RefreshCw } from "lucide-react";
import type { AnchorItem, StepType } from "../types";

interface AnchorQuestionStepProps {
  currentStep: StepType;
  currentAnchor: AnchorItem | null;
  q1Choice: string;
  setQ1Choice: (choice: string) => void;
  q2Choice: string;
  setQ2Choice: (choice: string) => void;
  confidence: number;
  setConfidence: (confidence: number) => void;
  isSubmitting: boolean;
  onQ1Next: () => void;
  onQ2Next: () => void;
  onAnchorSubmit: () => void;
  onStartDialogueSession: () => void;
}

export function AnchorQuestionStep({
  currentStep,
  currentAnchor,
  q1Choice,
  setQ1Choice,
  q2Choice,
  setQ2Choice,
  confidence,
  setConfidence,
  isSubmitting,
  onQ1Next,
  onQ2Next,
  onAnchorSubmit,
  onStartDialogueSession,
}: AnchorQuestionStepProps) {
  if (currentStep === "anchor_q1" && currentAnchor) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            共通アンカー項目: {currentAnchor.anchor_id}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> 設問 1 / 2（前提の抽出）
          </span>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">導入文</h2>
          <p className="text-sm text-slate-200 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
            {currentAnchor.intro}
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            AI同僚の提案文
          </h2>
          <div className="text-sm text-slate-100 bg-blue-950/20 p-4 rounded-lg border border-blue-900/40 leading-relaxed">
            「{currentAnchor.proposal}」
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-white">
            設問1: {currentAnchor.q1.question}
          </h3>
          <div className="space-y-2.5">
            {currentAnchor.q1.options.map((opt) => (
              <label
                key={opt.key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  q1Choice === opt.key
                    ? "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="q1"
                  value={opt.key}
                  checked={q1Choice === opt.key}
                  onChange={(e) => setQ1Choice(e.target.value)}
                  className="mt-1 text-blue-600 focus:ring-0"
                />
                <div className="text-sm leading-relaxed">
                  <span className="font-bold mr-2 text-blue-400">{opt.key}:</span>
                  {opt.text}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={onQ1Next}
            disabled={!q1Choice}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all disabled:opacity-40"
          >
            設問2へ進む
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === "anchor_q2" && currentAnchor) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            共通アンカー項目: {currentAnchor.anchor_id}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> 設問 2 / 2（トレードオフの深掘り）
          </span>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">
            設問2: {currentAnchor.q2.question}
          </h3>
          <div className="space-y-2.5">
            {currentAnchor.q2.options.map((opt) => (
              <label
                key={opt.key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  q2Choice === opt.key
                    ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="q2"
                  value={opt.key}
                  checked={q2Choice === opt.key}
                  onChange={(e) => setQ2Choice(e.target.value)}
                  className="mt-1 text-indigo-600 focus:ring-0"
                />
                <div className="text-sm leading-relaxed">
                  <span className="font-bold mr-2 text-indigo-400">{opt.key}:</span>
                  {opt.text}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={onQ2Next}
            disabled={!q2Choice}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40"
          >
            確信度評定へ
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === "anchor_conf") {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
          <HelpCircle className="w-5 h-5" />
          <span>確信度の自己評定（5段階）</span>
        </div>
        <h2 className="text-lg font-bold text-white">
          設問1および設問2の回答に対するご自身の確信度を選んでください
        </h2>
        <div className="grid grid-cols-5 gap-3 pt-2">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              onClick={() => setConfidence(val)}
              className={`p-4 rounded-xl border text-center transition-all ${
                confidence === val
                  ? "bg-blue-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/20"
                  : "bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="text-lg font-bold mb-1">{val}</div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {val === 1 && "全く自信なし"}
                {val === 2 && "やや不安"}
                {val === 3 && "普通"}
                {val === 4 && "やや自信あり"}
                {val === 5 && "非常に確信"}
              </div>
            </button>
          ))}
        </div>

        <div className="pt-6 flex justify-end">
          <button
            onClick={onAnchorSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                アンカー回答を送信・記録する
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === "anchor_complete") {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
        <div className="flex items-center gap-3 text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold text-white">共通アンカー項目の記録が完了しました</h2>
            <p className="text-xs text-slate-400">
              ステータス: <span className="font-mono text-emerald-400">anchor_status = pretest</span>（尺度較正用・無得点運用）
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-300 space-y-2">
          <p className="font-semibold text-slate-200">🚀 続いて動的課題の対話セッション（W3）へ進みます:</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            次はAI同僚が作成した実際の業務コード（決済セキュリティミドルウェア）をレビューする3ペイン対話セッションです。
            AI同僚のコードに含まれる前提の隠蔽や不備を対話で指摘し、修正指示を出してください。
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onStartDialogueSession}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25"
          >
            動的対話セッションへ進む
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
