"use client";

import React from "react";
import { Radar, ArrowRight, CircleDot, CircleDashed, CheckCircle2 } from "lucide-react";
import {
  EVIDENCE_TARGET_LABELS,
  PROBE_MOVE_LABELS,
  type EvidenceTargetState,
  type ProbeMove,
} from "../types";

interface MediationStatePanelProps {
  stateEstimate: EvidenceTargetState[] | null;
  lastProbeMove: ProbeMove | null;
  selectionRationale: string | null;
  probesIssued: number;
  maxProbes: number;
  isProbing: boolean;
}

const STATUS_STYLE: Record<
  EvidenceTargetState["status"],
  { label: string; className: string; Icon: typeof CircleDot }
> = {
  elicited: {
    label: "取得済み",
    className: "text-emerald-300 border-emerald-800/50 bg-emerald-950/40",
    Icon: CheckCircle2,
  },
  partial: {
    label: "部分的",
    className: "text-amber-300 border-amber-800/50 bg-amber-950/40",
    Icon: CircleDot,
  },
  not_elicited: {
    label: "未取得",
    className: "text-slate-400 border-slate-700/60 bg-slate-900/60",
    Icon: CircleDashed,
  },
};

/**
 * 走行中の状態推定の可視化（MVP 2.1 ステップ7・8）。
 *
 * **ここに出しているのは「正解までの距離」ではない。**受講者の判断とその理由が、
 * 動的コンピテンシー ルーブリックが求める5つの根拠カテゴリごとにどこまで言語化されたかの推定である。
 * 次に投げる問いはこの推定に応じて変わる。固定の問いの列を順に流しているのではない。
 */
export function MediationStatePanel({
  stateEstimate,
  lastProbeMove,
  selectionRationale,
  probesIssued,
  maxProbes,
  isProbing,
}: MediationStatePanelProps) {
  return (
    <div
      data-testid="mediation-state-panel"
      className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg space-y-3.5"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Radar className={`w-4 h-4 text-cyan-400 ${isProbing ? "animate-pulse" : ""}`} />
          媒介の状態推定（走行中）
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          深掘り {probesIssued} / {maxProbes} 手
        </span>
      </div>

      {!stateEstimate ? (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {isProbing
            ? "対話ログから、どの根拠がまだ引き出せていないかを推定しています…"
            : "AI同僚へ最初の指摘を送ると、そこまでの発言から状態を推定して次に問う内容を決めます。"}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {stateEstimate.map((t) => {
              const style = STATUS_STYLE[t.status];
              const Icon = style.Icon;
              return (
                <div
                  key={t.target}
                  title={t.basis}
                  className={`p-2.5 rounded-xl border text-[11px] leading-snug ${style.className}`}
                >
                  <div className="flex items-start gap-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {EVIDENCE_TARGET_LABELS[t.target] ?? t.target}
                      </div>
                      <div className="font-mono text-[10px] opacity-70">{style.label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {lastProbeMove && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-cyan-950/25 border border-cyan-900/40">
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed">
                <div className="font-semibold text-cyan-200">
                  この推定を踏まえて選んだ手: {PROBE_MOVE_LABELS[lastProbeMove] ?? lastProbeMove}
                </div>
                {selectionRationale && (
                  <div className="text-cyan-100/70">{selectionRationale}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 leading-tight">
        ※ 推定と選んだ手は{" "}
        <code className="text-cyan-400">mediation_probes</code>{" "}
        ログへ理由つきで保存されます。
        <strong className="text-slate-400">
          {" "}
          メディエーターには仕込み不備の位置を渡していません
        </strong>
        ——引き出すためであって、正解へ導くためではないためです。
      </div>
    </div>
  );
}
