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
  { no: 1, title: "課題提示", detail: "PRの仕様書や障害ログを精査し、重大な設計欠陥と仕様上妥当な設計を見分ける" },
  { no: 2, title: "検証対話", detail: "AIの反論や過剰指摘に対し、仕様や規程を根拠に検証・是正する" },
  {
    no: 3,
    title: "前提変化",
    detail: "緊急の仕様変更や納期短縮に対し、当初方針に固執せず方針を組み直す",
    disrupted: true,
  },
  { no: 4, title: "意思決定", detail: "AIの採点を見る前に［修正要求／条件付き承認／承認］と理由を自分で確定する" },
  { no: 5, title: "XAI診断", detail: "採点の根拠になった発言を示す診断を受け取り、振り返る" },
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
          <h1 className="text-display text-ink">実務演習セッション</h1>
          <Badge tone="positive">実稼働</Badge>
        </div>
        <p className="text-caption text-ink-2">AI同僚とのコードレビュー演習</p>
        {/* 読ませる文章は行長を抑える。全幅に流すと目線の戻りが長くなって読み飛ばされる */}
        <p className="max-w-2xl text-body text-ink-2">
          受講者はAI同僚と一緒にPRをレビューし、途中で入る仕様変更に対応したうえで、自分の判定を確定します。
          その対話と行動のログから、
          <strong className="font-medium text-ink">AI時代の実務判断力</strong>
          （評価的判断力・高次認知・対話的共創力・メタ認知の4観点）の証拠を取り出して採点します。
        </p>
        <p className="max-w-2xl text-caption text-ink-3">
          ここで出るのは1回の演習についての参考値です。受講者どうしを比べられるスコアにするのは、
          事業期間中に実装する共通尺度化エンジンの役割です。
        </p>
      </header>

      <Section title="演習の流れ" description="全5場面">
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
        title="取り組む課題"
        description={`全${DYNAMIC_TASKS.length}件`}
        actions={
          <Button variant="primary" onClick={onStartSession} disabled={isSubmitting}>
            {isSubmitting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-label="開始処理中" />
            ) : (
              "演習を開始する"
            )}
          </Button>
        }
      >
        <div className="space-y-block">
          <select
            aria-label="取り組む課題"
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
            <strong className="font-medium text-ink">固定設問について。</strong>{" "}
            全受講者が同じ条件で解く固定設問（SCT型）は、採点器のズレを外から見張るための第2層の基準です。
            上部の<strong className="font-medium text-ink">「固定設問（SCT型）」</strong>
            タブから単独で体験できます。演習のどこに挟むかはPoCを経て決めるため、プロトタイプでは分けてあります。
          </p>
          {onGoToAnchorTab && (
            <Button variant="secondary" onClick={onGoToAnchorTab} className="shrink-0">
              固定設問を体験する
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
