"use client";

import React from "react";
import { FileCheck, AlertCircle, RefreshCw, Award } from "lucide-react";

interface PreliminaryJudgementStepProps {
  prelimAction: "approve" | "remand" | "";
  setPrelimAction: (action: "approve" | "remand" | "") => void;
  prelimScore: number;
  setPrelimScore: (score: number) => void;
  prelimJustification: string;
  setPrelimJustification: (justification: string) => void;
  prelimError: string | null;
  isEvaluating: boolean;
  onBackToDialogue: () => void;
  onConfirmPreliminaryAndEvaluate: () => void;
}

export function PreliminaryJudgementStep({
  prelimAction,
  setPrelimAction,
  prelimScore,
  setPrelimScore,
  prelimJustification,
  setPrelimJustification,
  prelimError,
  isEvaluating,
  onBackToDialogue,
  onConfirmPreliminaryAndEvaluate,
}: PreliminaryJudgementStepProps) {
  return (
    <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <FileCheck className="w-6 h-6 text-indigo-400" />
          <div>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              CFF: Force Decision First & Mandatory Justification [MVP 2.5]
            </span>
            <h2 className="text-lg font-bold text-white mt-1">成果物の最終判定と判断理由の言語化</h2>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
        AIによる自動採点およびXAIレポートを開示する前に、受講者自身の判定と理由を先に入力・確定させます。
        AIの根拠提示前に受講者の自律的判断を取ることで、AI出力を無検証で追従するバイアスを排除します。
      </p>

      {prelimError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{prelimError}</span>
        </div>
      )}

      {/* 1. Decision Action */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          ① この成果物ドラフトに対する最終判断（必須）
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
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
              <div className="text-sm font-bold text-amber-400">⚠️ 差し戻し（修正が必要）</div>
              <p className="text-xs text-slate-400 mt-1">
                セキュリティ基準違反や要件不備、暗黙の前提破綻があり、本番リリース不可と判断。
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
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
              <div className="text-sm font-bold text-emerald-400">✅ 承認（リリース可能）</div>
              <p className="text-xs text-slate-400 mt-1">
                要件を満たしており、セキュリティ・可用性基準に適合していると判断。
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Self-Estimated Band */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          ② 軸4（評価的判断力）の観点で、自分は何点相当だと思いますか？
        </label>
        <div className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((band) => (
            <button
              key={band}
              onClick={() => setPrelimScore(band)}
              type="button"
              className={`p-3 rounded-xl border text-center transition-all ${
                prelimScore === band
                  ? "bg-blue-600 border-blue-500 text-white font-bold shadow-md shadow-blue-500/20"
                  : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="text-base font-bold">Band {band}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {band === 0 && "未達"}
                {band === 1 && "盲目追従"}
                {band === 2 && "違和感"}
                {band === 3 && "前提摘発"}
                {band === 4 && "卓越弁別"}
                {band === 5 && "指導的"}
              </div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          ※ この自己評点はAI採点には入力されず、バイアス度合いの観測ログとして記録されます。
        </p>
      </div>

      {/* 3. Mandatory Justification */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block flex items-center justify-between">
          <span>③ 判断理由・根拠（必須記述・Mandatory Justification）</span>
          <span className="text-rose-400 text-[10px] font-normal font-mono">※ 省略不可・空文字不可</span>
        </label>
        <textarea
          value={prelimJustification}
          onChange={(e) => setPrelimJustification(e.target.value)}
          placeholder="承認または差し戻しと判断した具体的な根拠・理由を記述してください（例: JWT署名検証のみではRedis側のトークン失効伝播が確認できず、PCI DSSの強制ログアウト要件に違反しているため）"
          className="w-full bg-slate-950 text-xs text-slate-100 p-3.5 rounded-xl border border-slate-700 h-28 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
        />
        <p className="text-[11px] text-slate-400">
          ※ 承認・差し戻しのいずれの場合も、理由の記述は省略できません。素通し防止のためサーバ側でも必須チェックされます。
        </p>
      </div>

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
          disabled={isEvaluating || !prelimAction || !prelimJustification.trim()}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-40"
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
