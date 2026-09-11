"use client";

import React from "react";
import { Zap, ShieldCheck } from "lucide-react";

interface TelemetryPanelProps {
  learnerId: string;
  sessionId: string;
  sessionSeq: number;
  telemetryLog: string[];
}

export function TelemetryPanel({
  learnerId,
  sessionId,
  sessionSeq,
  telemetryLog,
}: TelemetryPanelProps) {
  return (
    <div className="space-y-6">
      {/* Telemetry Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Zap className="w-4 h-4 text-amber-400" />
            Live Telemetry Monitor
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Connected
          </span>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-500">Learner ID:</span>
            <span className="text-slate-300 truncate max-w-[160px]" title={learnerId}>
              {learnerId ? learnerId.slice(0, 16) + "..." : "Not initialized"}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-500">Session Seq:</span>
            <span className="text-blue-400 font-bold">
              {sessionId ? `#${sessionSeq}` : "-"}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-500">Target Axis:</span>
            <span className="text-purple-400 font-semibold">軸4（前提・倫理）</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-500">Scorer Version:</span>
            <span className="text-slate-400 text-[10px]">configurable LLM / extract-v5 / score-v3</span>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Telemetry Event Stream
          </div>
          <div className="h-60 overflow-y-auto bg-slate-950/90 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1.5">
            {telemetryLog.length === 0 ? (
              <div className="text-slate-600 italic">待機中... セッションを開始するとイベントが記録されます</div>
            ) : (
              telemetryLog.map((log, i) => (
                <div key={i} className="leading-snug text-slate-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Audit & Compliance Specs Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          検証・テレメトリ仕様準拠
        </div>
        <ul className="space-y-1.5 text-[11px] list-disc list-inside">
          <li>データモデル: `learners`, `sessions`, `ratings`, `learner_preliminary_judgements`, `verification_focus_sequences` 本番準拠</li>
          <li>AutoSCORE: 自由記述CoTを排した2段階構造化採点（設定可能モデル）</li>
          <li>CFF機能: Force Decision First & Mandatory Justification</li>
          <li>3ペイン: 要件・成果物エディタ・検証パネル（focus_seq 順序追跡）</li>
          <li>XAIレポート: 根拠スパンの可視化と異議申立導線（MVP 4.5）</li>
        </ul>
      </div>
    </div>
  );
}
