"use client";

import React, { useState } from "react";
import {
  SCENARIO_DEBRIEFINGS,
  type ScenarioDebriefingData,
  type CompetencyActionItem,
} from "@/data/benchmark-gallery-data";
import { Badge, Button, Card, cn } from "./ui";

interface BenchmarkGalleryProps {
  initialTaskId?: string;
  onStartSession: (taskId: string) => void;
  onBackToDashboard?: () => void;
}

/** 採用率の横バー。ルートごとの色分けはしない——採用率に良し悪しは無い。 */
function AdoptionBar({ ratio }: { ratio: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-chip bg-surface">
      <div
        className="h-full rounded-chip bg-accent"
        style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }}
      />
    </div>
  );
}

/** 層の見出し。層番号は小さく淡く、内容の見出しを主にする。 */
function LayerHeader({
  layer,
  title,
  aside,
}: {
  layer: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-3 border-b border-line pb-3 sm:flex-row sm:items-center">
      <div className="space-y-0.5">
        <p className="text-caption text-ink-3">{layer}</p>
        <h3 className="text-title text-ink">{title}</h3>
      </div>
      {aside}
    </div>
  );
}

export function BenchmarkGallery({
  initialTaskId,
  onStartSession,
  onBackToDashboard,
}: BenchmarkGalleryProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    initialTaskId || SCENARIO_DEBRIEFINGS[0].taskId
  );

  const [statusFilter, setStatusFilter] = useState<"all" | "observed" | "not_observed" | "bookmarked">("all");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const currentScenario: ScenarioDebriefingData =
    SCENARIO_DEBRIEFINGS.find((b) => b.taskId === selectedTaskId) || SCENARIO_DEBRIEFINGS[0];

  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    setSelectedRouteId(null);
  };

  const toggleBookmark = (actionId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  // Filter actions based on statusFilter
  const filterAction = (action: CompetencyActionItem) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "observed") return action.status === "observed";
    if (statusFilter === "not_observed") return action.status === "not_observed";
    if (statusFilter === "bookmarked") return bookmarkedIds.has(action.id);
    return true;
  };

  // Counts for summary
  const allActions = currentScenario.competencyGroups.flatMap((g) => g.actions);
  const observedCount = allActions.filter((a) => a.status === "observed").length;
  const notObservedCount = allActions.filter((a) => a.status === "not_observed").length;
  const currentScenarioBookmarkedCount = allActions.filter((a) => bookmarkedIds.has(a.id)).length;

  const FILTERS: { id: typeof statusFilter; label: string }[] = [
    { id: "all", label: "すべて表示" },
    { id: "observed", label: `観測あり（${observedCount}）` },
    { id: "not_observed", label: `未観測（${notObservedCount}）` },
    { id: "bookmarked", label: `参考になった（${currentScenarioBookmarkedCount}）` },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-section pb-12">
      {/* 画面ヘッダー */}
      <header className="space-y-2 border-b border-line pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-ink-3">エキスパート事後講評＆デブリーフィング</p>
          {onBackToDashboard && (
            <Button variant="quiet" onClick={onBackToDashboard}>
              ← 組織分析ダッシュボードへ戻る
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-cell">
          <h1 className="text-display tracking-tight text-ink">
            シナリオ分析＆エキスパート検証戦略
          </h1>
          <Badge tone="neutral">Viability</Badge>
        </div>
        <p className="max-w-3xl text-body text-ink-2">
          AIが仕掛けた欺瞞トリックの解剖、上位者が採用した複数の攻略ルート、そして観測された客観的行動ログ（テレメトリ）を対比します。
          限られたターン数の中でどのアプローチを選択するかは受講者の自律的判断です。説教や行動の強制を行わず、上位者のアプローチを客観的な選択肢・引き出しとして提供します。
        </p>
      </header>

      {/* モック層の明示（Constitution Principle I / RV-I2） */}
      <aside
        aria-label="モック画面に関する注意"
        className="rounded-card border border-line bg-surface p-3.5 text-caption text-ink-2"
      >
        <p>
          <strong className="font-semibold text-ink">【画面仕様に関するご案内】</strong>{" "}
          本画面（エキスパート事後講評＆デブリーフィング）は、受検後の振り返り体験を検証するためのモック展示層（Viability）です。
          掲載されているエキスパート検証戦略・行動ログ・採用率は設計モックデータであり、実DBとの永続化結合は行っていません。
        </p>
      </aside>

      {/*
        シナリオの選択。**下線タブにはしない**——課題名が1行に収まらない長さなので、
        折り返した瞬間に上の行の下線が宙に浮き、下の行と重なる。
        長い項目を横に並べるなら、下線ではなく面で選択を示すほうが壊れない。
      */}
      <div className="grid grid-cols-1 gap-cell sm:grid-cols-3" aria-label="シナリオの切り替え">
        {SCENARIO_DEBRIEFINGS.map((scenario) => {
          const isSelected = scenario.taskId === selectedTaskId;
          return (
            <button
              key={scenario.taskId}
              onClick={() => handleTaskChange(scenario.taskId)}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                "flex flex-col items-start gap-row rounded-card border p-cell text-left transition-colors",
                isSelected
                  ? "border-accent bg-accent-wash"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <span className={cn("text-caption", isSelected ? "font-semibold text-ink" : "text-ink-2")}>
                {scenario.taskTitle}
              </span>
              <Badge tone={isSelected ? "accent" : "neutral"}>
                {scenario.domainLabel.split("/")[0].trim()}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* 選択中シナリオの概要と受講者セッション連携バー */}
      <Card>
        <div className="space-y-block">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-caption text-ink-3">
                <span>{currentScenario.domainLabel}</span>
                <span data-numeric>総受検セッション N={currentScenario.totalSessions}</span>
              </p>
              <h2 className="text-title text-ink">{currentScenario.taskTitle}</h2>
              <p className="text-caption text-ink-2">{currentScenario.shortSummary}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <p className="rounded-chip border border-line bg-surface-sunken px-3 py-2 text-caption text-ink-2">
                データ母集団:{" "}
                <strong className="font-semibold text-ink">
                  {currentScenario.topPerformerDefinition}
                </strong>
              </p>
              <Button
                variant="primary"
                onClick={() => onStartSession(currentScenario.taskId)}
              >
                この課題を解いてみる
              </Button>
            </div>
          </div>

          {/* 今回のセッションログ照合結果 */}
          <div className="flex flex-col justify-between gap-3 border-t border-line pt-4 text-caption md:flex-row md:items-center">
            <p className="text-ink-2">
              <strong className="font-semibold text-ink">今回のセッションログ照合結果:</strong>{" "}
              観測された事実のみを客観的に照合表示しています
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="positive">該当（観測あり）: {observedCount}件</Badge>
              <Badge tone="neutral">未観測（非該当）: {notObservedCount}件</Badge>
              {currentScenarioBookmarkedCount > 0 && (
                <Badge tone="caution">参考になった: {currentScenarioBookmarkedCount}件</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          第1層：課題トラップ構造の解剖 (Trap Architecture)
         ───────────────────────────────────────────────────────────── */}
      <section className="rounded-card border border-line bg-surface p-6">
        <LayerHeader
          layer="Layer 01"
          title="課題トラップ構造の解剖（AIのミスリードと認知バイアス）"
          aside={
            <Badge tone="caution">
              受講者全体の {currentScenario.trapArchitecture.overallMissRate}% が遭遇
            </Badge>
          }
        />

        <div className="mb-4 space-y-1 rounded-card border border-line bg-surface-sunken p-4">
          <p className="text-section text-ink">{currentScenario.trapArchitecture.title}</p>
          <p className="text-caption text-ink-2">
            {currentScenario.trapArchitecture.statHighlight}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-4">
            <p className="text-section text-ink">
              AIが仕掛けた欺瞞のメカニズム（コード・テストのトリック）
            </p>
            <p className="text-caption text-ink-2">
              {currentScenario.trapArchitecture.aiDeceptionMechanism}
            </p>
          </div>

          <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-4">
            <p className="text-section text-ink">
              人間が陥りやすい認知バイアス（心理的脆弱性）
            </p>
            <p className="text-caption text-ink-2">
              {currentScenario.trapArchitecture.cognitiveBias}
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          第2層：攻略ルート分岐図 (Strategy Branches)
         ───────────────────────────────────────────────────────────── */}
      <section className="rounded-card border border-line bg-surface p-6">
        <LayerHeader
          layer="Layer 02"
          title="上位者の攻略ルート分岐図（価値中立な戦略比較）"
          aside={
            <span className="text-caption text-ink-3">正解は1つではありません。各アプローチの特性を学べます</span>
          }
        />

        <p className="mb-4 text-caption text-ink-2">
          上位者層（Level
          4〜5）は、単一の手順に依存せず、自身の強みやシチュエーションに応じた複数の有効な検証ルートを採用していました。
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {currentScenario.strategyRoutes.map((route) => {
            const isSelected = selectedRouteId === route.id;
            return (
              <div
                key={route.id}
                onClick={() => setSelectedRouteId(isSelected ? null : route.id)}
                className={cn(
                  "cursor-pointer rounded-card border p-4 transition-colors",
                  isSelected
                    ? "border-accent bg-accent-wash"
                    : "border-line bg-surface-sunken hover:border-line-strong",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge tone="neutral">{route.badge}</Badge>
                  <span className="text-caption text-ink-2" data-numeric>
                    <strong className="font-semibold text-ink">{route.adoptionRate}%</strong> が採用
                  </span>
                </div>

                <h4 className="mb-2 text-section text-ink">{route.title}</h4>

                <div className="mb-3">
                  <AdoptionBar ratio={route.adoptionRate} />
                </div>

                <dl className="space-y-2 text-caption">
                  <div>
                    <dt className="text-ink-3">適した状況:</dt>
                    <dd className="mt-0.5 leading-relaxed text-ink-2">{route.targetContext}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">上位者の具体行動:</dt>
                    <dd className="mt-0.5 leading-relaxed text-ink-2">{route.keyActionSummary}</dd>
                  </div>
                  <div className="border-t border-line pt-2">
                    <dt className="text-ink-3">メリット・留意点:</dt>
                    <dd className="mt-0.5 leading-relaxed text-ink-2">{route.prosAndCons}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          第3層：動的コンピテンシー別・上位者アクション突合 (Competency Debriefing)
         ───────────────────────────────────────────────────────────── */}
      <section className="rounded-card border border-line bg-surface p-6">
        <LayerHeader
          layer="Layer 03"
          title="動的コンピテンシー別・上位者アクションと観測事実"
          aside={
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "rounded-chip border px-2.5 py-1 text-caption transition-colors",
                    statusFilter === f.id
                      ? "border-accent bg-accent-wash font-semibold text-ink"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        />

        <p className="mb-5 text-caption text-ink-2">
          上位者が各コンピテンシー領域で実際に取った行動を客観的に抽出しています。
          限られたターン数の中での選択を尊重し、未観測の項目は「参考になった」ボタンでピン留めして自身の引き出しとしてストックできます。
        </p>

        <div className="space-y-section">
          {currentScenario.competencyGroups.map((group) => {
            const filteredActions = group.actions.filter(filterAction);
            if (filteredActions.length === 0) return null;

            return (
              <div key={group.domainId} className="space-y-cell">
                <h4 className="flex flex-wrap items-baseline gap-2">
                  <span className="text-section text-ink">{group.domainName}</span>
                  <span className="text-data text-ink-3">({group.domainEn})</span>
                </h4>

                <div className="space-y-cell">
                  {filteredActions.map((action) => {
                    const isObserved = action.status === "observed";
                    const isBookmarked = bookmarkedIds.has(action.id);

                    return (
                      <div
                        key={action.id}
                        className={cn(
                          "rounded-card border p-4",
                          // 観測できた項目は左の帯で示す。並べたときに拾える手がかりが要る
                          isObserved
                            ? "border-y-line border-r-line border-l-2 border-l-positive bg-surface-sunken"
                            : "border-line bg-surface-sunken",
                        )}
                      >
                        <div className="mb-2 flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 shrink-0">
                              {isObserved ? (
                                <Badge tone="positive">ログ観測あり</Badge>
                              ) : (
                                <Badge tone="neutral">未観測</Badge>
                              )}
                            </span>
                            <div className="min-w-0">
                              <h5 className="text-section text-ink">{action.title}</h5>
                              <p className="mt-0.5 text-caption text-ink-2">
                                {action.description}
                              </p>
                            </div>
                          </div>

                          {/* 統計ベンチマーク */}
                          <dl className="flex shrink-0 items-center gap-4 rounded-chip border border-line bg-surface px-3 py-2">
                            <div>
                              <dt className="text-caption text-ink-3">上位者実施率</dt>
                              <dd className="text-section font-semibold text-accent" data-numeric>
                                {action.topPerformerRate}%
                              </dd>
                            </div>
                            <div className="h-6 w-px bg-line" />
                            <div>
                              <dt className="text-caption text-ink-3">全体平均</dt>
                              <dd className="text-section text-ink-2" data-numeric>
                                {action.overallRate}%
                              </dd>
                            </div>
                          </dl>
                        </div>

                        {/* 詳細コンテンツ */}
                        <div className="mt-3 space-y-cell border-t border-line pt-3">
                          {isObserved ? (
                            <>
                              {/* 該当：観測されたあなたのアプローチ */}
                              <div className="space-y-1 rounded-chip border border-positive/25 bg-positive-wash p-3">
                                <p className="text-section text-ink">
                                  今回のセッションで観測されたあなたの切り口:
                                </p>
                                <p className="text-caption text-ink-2">{action.userApproach}</p>
                              </div>

                              {/* 該当：上位者の切り口バリエーション */}
                              <div className="space-y-1.5 rounded-chip border border-line bg-surface p-3">
                                <p className="text-section text-ink">
                                  上位者に多く見られたアプローチ（切り口のバリエーション）:
                                </p>
                                <ul className="list-outside list-disc space-y-1 pl-4 text-caption text-ink-2">
                                  {action.topPerformerApproaches.map((approach, idx) => (
                                    <li key={idx}>{approach}</li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* 非該当：未観測の説明と上位者アプローチ */}
                              <p className="rounded-chip border border-line bg-surface p-2.5 text-caption text-ink-2">
                                ※ 今回の時間制限・ターン数配分の中では、このアプローチは観測されませんでした。
                              </p>

                              <div className="space-y-1.5 rounded-chip border border-line bg-surface p-3">
                                <p className="text-section text-ink">
                                  上位者のアプローチ例（別解としての引き出し）:
                                </p>
                                <ul className="list-outside list-disc space-y-1 pl-4 text-caption text-ink-2">
                                  {action.topPerformerApproaches.map((approach, idx) => (
                                    <li key={idx}>{approach}</li>
                                  ))}
                                </ul>
                              </div>

                              {/* 自律的な「参考になった」ピン留めボタン */}
                              <div className="flex justify-end pt-1">
                                <button
                                  onClick={() => toggleBookmark(action.id)}
                                  className={cn(
                                    "rounded-chip border px-3 py-1.5 text-caption transition-colors",
                                    isBookmarked
                                      ? "border-caution/40 bg-caution-wash font-semibold text-ink"
                                      : "border-line-strong bg-surface text-ink-2 hover:bg-surface-sunken",
                                  )}
                                >
                                  {isBookmarked
                                    ? "参考になった（ピン留め中）"
                                    : "参考になった（ピン留めして保存）"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* フッターCTA */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-card border border-line bg-surface-sunken p-6 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h4 className="text-title text-ink">
            別の角度・アプローチで課題を試してみますか？
          </h4>
          <p className="text-caption text-ink-2">
            上位者の攻略ルートや新しい切り口を意識して、演習セッションを自由に再実行できます。
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => onStartSession(currentScenario.taskId)}
          className="shrink-0"
        >
          この課題を解き直す
        </Button>
      </div>
    </div>
  );
}
