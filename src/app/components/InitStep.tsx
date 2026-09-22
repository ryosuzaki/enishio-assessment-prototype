"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { DYNAMIC_TASKS, type DynamicTaskScenario } from "@/data/dynamic-task";
import { Badge, Button, Card, Section, cn } from "./ui";

interface InitStepProps {
  selectedTaskId: string;
  setSelectedTaskId: (id: string) => void;
  selectedTask: DynamicTaskScenario;
  isSubmitting: boolean;
  onStartSession: () => void;
  onGoToAnchorTab?: () => void;
}

/** 演習セッションの 5 場面。場面 3 だけが「異常イベント」なので、そこにだけ意味色を割り当てる。 */
const SCENE_FLOW: { no: number; title: string; detail: string; disrupted?: boolean }[] = [
  { no: 1, title: "課題提示・精査", detail: "要件・コード・テストの精査と着眼点の整理" },
  { no: 2, title: "反駁対話", detail: "AI同僚の自説弁護に対し仕様根拠で反駁・修正指示" },
  {
    no: 3,
    title: "前提変化（緊急仕様変更）",
    detail: "突然の制約変更に対する方針の再適応と方針更新",
    disrupted: true,
  },
  { no: 4, title: "意思決定（CFF）", detail: "AI採点前に［承認／条件付き承認／修正要求］を先行確定" },
  { no: 5, title: "構造化採点パイプライン XAI診断", detail: "2段階客観評価・根拠ハイライト・異議申立導線" },
];

export function InitStep({
  selectedTaskId,
  setSelectedTaskId,
  selectedTask,
  isSubmitting,
  onStartSession,
  onGoToAnchorTab,
}: InitStepProps) {
  return (
    <div className="space-y-section">
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-cell">
          <h1 className="text-display text-ink">動的実務演習セッション</h1>
          <Badge tone="neutral">Feasibility 実証</Badge>
        </div>
        <p className="text-caption text-ink-2">AI同僚協働・レビュー対話</p>
        {/* 読ませる文章は行長を抑える。全幅に流すと目線の戻りが長くなって読み飛ばされる */}
        <p className="max-w-2xl text-body text-ink-2">
          動的コンピテンシー アセスメント＆テレメトリ基盤の中核にあたる画面です。
          受講者が生成AIと協働しながら、不確実な実務課題に取り組むプロセス全体を通じて、
          <strong className="font-medium text-ink">
            動的コンピテンシー4領域（評価的判断力、高次認知・動的思考、対話的共創力、メタ認知・適応力）
          </strong>
          を観測・評価します。
        </p>
      </header>

      <Section title="演習セッションの動作フロー" description="全5場面・提案書 ①3 準拠">
        {/*
          5 場面は順序が意味を持つ列なので、番号を振る。番号は飾りではなく、
          「どこで何が起きるか」を指す索引として機能する。
        */}
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-5">
          {SCENE_FLOW.map((scene) => (
            <li
              key={scene.no}
              className={cn("space-y-1 p-cell", scene.disrupted ? "bg-caution-wash" : "bg-surface")}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-label text-ink-3" data-numeric>
                  場面 {scene.no}
                </span>
                {scene.disrupted && <Badge tone="caution">前提変化</Badge>}
              </div>
              <p className="text-section text-ink">{scene.title}</p>
              <p className="text-caption text-ink-2">{scene.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="取り組む動的課題"
        description={`T-06a タスクレジストリ / 全${DYNAMIC_TASKS.length}件`}
        actions={
          <Button variant="primary" onClick={onStartSession} disabled={isSubmitting}>
            {isSubmitting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-label="開始処理中" />
            ) : (
              "実務演習セッションを開始する（課題提示へ）"
            )}
          </Button>
        }
      >
        <div className="space-y-block">
          <select
            aria-label="取り組む動的課題"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className={cn(
              "w-full rounded-chip border border-line-strong bg-surface px-cell py-2 text-body text-ink",
              "focus:border-accent focus:outline-none",
            )}
          >
            {DYNAMIC_TASKS.map((t) => (
              <option key={t.task_id} value={t.task_id}>
                [{t.task_id}] {t.title}
              </option>
            ))}
          </select>

          {/* 選択した課題の素性。枠は持たせず、罫線 1 本と余白で「読み値の並び」にする */}
          <dl className="grid grid-cols-[10rem_1fr] gap-x-block border-y border-line">
            <dt className="border-b border-line py-2 text-label text-ink-3">ドメイン</dt>
            <dd className="border-b border-line py-2 text-caption text-ink">{selectedTask.domain}</dd>
            <dt className="py-2 text-label text-ink-3">場面3 前提変化シナリオ</dt>
            <dd className="py-2 text-caption text-ink">
              同梱（{selectedTask.premise_shift?.title.slice(0, 24)}…）
            </dd>
          </dl>
        </div>
      </Section>

      <Card variant="inset" className="p-pad">
        <div className="flex flex-col items-start justify-between gap-cell sm:flex-row sm:items-center">
          <p className="max-w-2xl text-caption text-ink-2">
            <strong className="font-medium text-ink">共通アンカー評価について。</strong>{" "}
            採点器ドリフト検知・尺度等化のための固定設問（SCT型）は、上部ナビゲーションの
            <strong className="font-medium text-ink">「② 共通アンカー評価」</strong>
            タブから個別にいつでも体験できます。
            運用時の挿入場所や頻度は実証PoCを経て決定するため、プロトタイプでは両者を分離して体験可能にしています。
          </p>
          {onGoToAnchorTab && (
            <Button variant="secondary" onClick={onGoToAnchorTab} className="shrink-0">
              アンカー評価を見る
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
