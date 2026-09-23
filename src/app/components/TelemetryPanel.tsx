"use client";

import React from "react";
import type { EvidenceTargetState, ProbeMove } from "../types";
import { MediationStatePanel } from "./MediationStatePanel";
import { Badge, Card, cn } from "./ui";

interface TelemetryPanelProps {
  learnerId: string;
  sessionId: string;
  sessionSeq: number;
  telemetryLog: string[];
  /** 採点APIが返した実際の版。採点前は null（直書きの版を出すと実際の採点器と食い違う） */
  scorerModelVersion?: string | null;
  onToggleCollapse?: () => void;
  // Socratic Mediator State
  mediationStateEstimate?: EvidenceTargetState[] | null;
  lastProbeMove?: ProbeMove | null;
  lastSelectionRationale?: string | null;
  probesIssued?: number;
  maxProbes?: number;
  isProbing?: boolean;
}

/**
 * 計器としての読み値。ラベルは淡く、値は本文の濃さで揃える。
 *
 * 値は省略せず折り返す——採点器のバージョンのような「照合のための値」は、
 * 末尾が切れた時点で用をなさない。
 */
function Reading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5 border-b border-line py-2 last:border-b-0">
      <dt className="text-label text-ink-3">{label}</dt>
      <dd className="break-words text-caption text-ink" data-numeric>
        {children}
      </dd>
    </div>
  );
}

export function TelemetryPanel({
  learnerId,
  sessionId,
  sessionSeq,
  telemetryLog,
  scorerModelVersion,
  onToggleCollapse,
  mediationStateEstimate,
  lastProbeMove,
  lastSelectionRationale,
  probesIssued,
  maxProbes,
  isProbing,
}: TelemetryPanelProps) {
  return (
    <div className="space-y-block">
      <Card
        title="計測ログ"
        meta={
          <span className="flex items-center gap-2">
            <Badge tone="positive">記録中</Badge>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="モニターを閉じて画面を広く使う"
                className="rounded-chip px-1 text-label text-ink-3 transition-colors hover:text-ink"
              >
                閉じる
              </button>
            )}
          </span>
        }
      >
        <dl>
          <Reading label="受講者ID">
            <span title={learnerId}>{learnerId ? learnerId.slice(0, 16) + "…" : "未開始"}</span>
          </Reading>
          <Reading label="セッション番号">{sessionId ? `#${sessionSeq}` : "—"}</Reading>
          <Reading label="測定対象">AI時代の実務判断力（4観点）</Reading>
          <Reading label="採点器の版">{scorerModelVersion ?? "採点後に表示"}</Reading>
        </dl>

        <div className="mt-block space-y-row">
          <p className="text-label text-ink-3">イベント記録</p>
          {/* 機械が吐いたログなので等幅で出す。読み物の本文には等幅を使わない */}
          {/* 空のときに枠だけが大きく空くのを避け、記録が溜まってから伸ばす */}
          <div
            className={cn(
              "space-y-1.5 overflow-y-auto rounded-chip border border-line bg-surface-sunken p-3",
              "font-mono text-data leading-relaxed text-ink-2",
              telemetryLog.length === 0 ? "min-h-[3rem]" : "h-[220px]",
            )}
          >
            {telemetryLog.length === 0 ? (
              <p className="text-ink-3">待機中… セッションを開始するとイベントが記録されます</p>
            ) : (
              telemetryLog.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </div>
      </Card>

      {/* Socratic Mediator State Estimation (Inspector View) */}
      {(mediationStateEstimate !== undefined || lastProbeMove !== undefined) && (
        <MediationStatePanel
          stateEstimate={mediationStateEstimate ?? null}
          lastProbeMove={lastProbeMove ?? null}
          selectionRationale={lastSelectionRationale ?? null}
          probesIssued={probesIssued ?? 0}
          maxProbes={maxProbes ?? 4}
          isProbing={isProbing ?? false}
        />
      )}

      <Card title="この画面で動いているもの">
        <ul className="list-outside list-disc space-y-row pl-4 text-caption text-ink-2">
          <li>
            データモデル: <code className="font-mono text-data text-ink">learners</code>,{" "}
            <code className="font-mono text-data text-ink">sessions</code>,{" "}
            <code className="font-mono text-data text-ink">ratings</code>,{" "}
            <code className="font-mono text-data text-ink">prompt_turns</code>,{" "}
            <code className="font-mono text-data text-ink">learner_preliminary_judgements</code> へ実DB記録
          </li>
          <li>構造化採点パイプライン: 証拠抽出 → ルーブリック採点の2段階（実LLM）</li>
          <li>意思決定: AIの採点を見る前に判定と理由を確定</li>
          <li>2ペイン演習: 課題要件・成果物エディタ ＆ コード引用連動チャット</li>
          <li>XAI診断: 採点根拠の発言をハイライトし、異議申立を受け付ける</li>
        </ul>
      </Card>
    </div>
  );
}
