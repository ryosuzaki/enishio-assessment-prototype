"use client";

import React from "react";
import { Badge, Card, cn } from "./ui";

interface TelemetryPanelProps {
  learnerId: string;
  sessionId: string;
  sessionSeq: number;
  telemetryLog: string[];
  onToggleCollapse?: () => void;
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
  onToggleCollapse,
}: TelemetryPanelProps) {
  return (
    <div className="space-y-block">
      <Card
        title="Live Telemetry Monitor"
        meta={
          <span className="flex items-center gap-2">
            <Badge tone="positive">Connected</Badge>
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
          <Reading label="Learner ID">
            <span title={learnerId}>{learnerId ? learnerId.slice(0, 16) + "…" : "Not initialized"}</span>
          </Reading>
          <Reading label="Session Seq">{sessionId ? `#${sessionSeq}` : "—"}</Reading>
          <Reading label="Target Axis">動的コンピテンシー（4領域総合）</Reading>
          <Reading label="Scorer Version">configurable LLM / extract-v6 / score-v3</Reading>
        </dl>

        <div className="mt-block space-y-row">
          <p className="text-label text-ink-3">Telemetry Event Stream</p>
          {/* 機械が吐いたログなので等幅で出す。読み物の本文には等幅を使わない */}
          {/* 空のときに枠だけが大きく空くのを避け、記録が溜まってから伸ばす */}
          <div
            className={cn(
              "space-y-1.5 overflow-y-auto rounded-chip border border-line bg-surface-sunken p-3",
              "font-mono text-data leading-relaxed text-ink-2",
              telemetryLog.length === 0 ? "min-h-[3rem]" : "h-[270px]",
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

      <Card title="検証・テレメトリ仕様準拠">
        <ul className="list-outside list-disc space-y-row pl-4 text-caption text-ink-2">
          <li>
            データモデル: <code className="font-mono text-data text-ink">learners</code>,{" "}
            <code className="font-mono text-data text-ink">sessions</code>,{" "}
            <code className="font-mono text-data text-ink">ratings</code>,{" "}
            <code className="font-mono text-data text-ink">learner_preliminary_judgements</code>,{" "}
            <code className="font-mono text-data text-ink">verification_focus_sequences</code> 本番準拠
          </li>
          <li>AutoSCORE: 自由記述CoTを排した2段階構造化採点（設定可能モデル）</li>
          <li>CFF機能: Force Decision First &amp; Mandatory Justification</li>
          <li>3ペイン: 要件・成果物エディタ・検証パネル（focus_seq 順序追跡）</li>
          <li>XAIレポート: 根拠スパンの可視化と異議申立導線（MVP 4.5）</li>
        </ul>
      </Card>
    </div>
  );
}
