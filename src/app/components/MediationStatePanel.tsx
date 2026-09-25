"use client";

import React from "react";
import {
  EVIDENCE_TARGET_LABELS,
  PROBE_MOVE_LABELS,
  type EvidenceTargetState,
  type ProbeMove,
} from "../types";
import { Badge, Card, cn } from "./ui";

interface MediationStatePanelProps {
  stateEstimate: EvidenceTargetState[] | null;
  lastProbeMove: ProbeMove | null;
  selectionRationale: string | null;
  probesIssued: number;
  maxProbes: number;
  isProbing: boolean;
}

/**
 * 根拠カテゴリごとの取得状況。3 値は測定の状態そのものなので意味色を割り当てる
 * （分類ではないため `[D-101]` の「意味色は状態にだけ使う」に反しない）。
 */
const STATUS_STYLE: Record<
  EvidenceTargetState["status"],
  { label: string; tone: "positive" | "caution" | "neutral"; cell: string }
> = {
  elicited: { label: "取得済み", tone: "positive", cell: "border-positive/25 bg-positive-wash" },
  partial: { label: "部分的", tone: "caution", cell: "border-caution/25 bg-caution-wash" },
  not_elicited: { label: "未取得", tone: "neutral", cell: "border-line bg-surface-sunken" },
};

/**
 * 走行中の状態推定の可視化（MVP 2.1 ステップ7・8）。
 *
 * **ここに出しているのは「正解までの距離」ではない。**受講者の判断とその理由が、
 * AI時代の実務判断力 ルーブリックが求める5つの根拠カテゴリごとにどこまで言語化されたかの推定である。
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
    <div data-testid="mediation-state-panel">
      <Card
        title="進行役の状態推定"
        meta={
          <span data-numeric>
            深掘り {probesIssued} / {maxProbes} 手
          </span>
        }
      >
        <div className="space-y-cell">
          {!stateEstimate ? (
            <p className="text-caption text-ink-2">
              {isProbing
                ? "対話ログから、どの根拠がまだ引き出せていないかを推定しています…"
                : "AI同僚へ最初の指摘を送ると、そこまでの発言から状態を推定して次に問う内容を決めます。"}
            </p>
          ) : (
            <>
              {/* 右の細い列に置くため、1行に1観点で縦に並べる（横に5列並べると文字が1字ずつ折り返す） */}
              <ul className="space-y-1.5">
                {stateEstimate.map((t) => {
                  const style = STATUS_STYLE[t.status];
                  return (
                    <li
                      key={t.target}
                      title={t.basis}
                      className={cn("flex items-start justify-between gap-2 rounded-chip border p-2.5", style.cell)}
                    >
                      <p className="min-w-0 text-caption leading-snug text-ink">
                        {EVIDENCE_TARGET_LABELS[t.target] ?? t.target}
                      </p>
                      <Badge tone={style.tone} className="shrink-0">{style.label}</Badge>
                    </li>
                  );
                })}
              </ul>

              {lastProbeMove && (
                <div className="space-y-1 rounded-chip border border-line bg-surface-sunken p-3">
                  <p className="text-section leading-relaxed text-ink">
                    この推定を踏まえて選んだ手: {PROBE_MOVE_LABELS[lastProbeMove] ?? lastProbeMove}
                  </p>
                  {selectionRationale && (
                    <p className="text-caption text-ink-2">{selectionRationale}</p>
                  )}
                </div>
              )}
            </>
          )}

          <p className="border-t border-line pt-2.5 text-caption text-ink-3">
            ※ 進行役は対話ログから受講者の着眼状態を推定し、正解誘導ではなく自律的な気付きを促す問いを生成します。
          </p>
        </div>
      </Card>
    </div>
  );
}
