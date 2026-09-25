"use client";

import React, { useState } from "react";
import { Badge, Button, Card, cn, thresholdTone, toneChip } from "./ui";

interface LearnerProfileProps {
  onStartSession: (taskId?: string) => void;
}

interface SubDimension {
  id: string;
  domainId: "eval" | "cognitive" | "dialogue" | "meta";
  domainName: string;
  name: string;
  band: number;
  score: number;
  description: string;
  observedEvidence: {
    turnIndex: number;
    quote: string;
    analysis: string;
  };
}

const SUB_DIMENSIONS: SubDimension[] = [
  // 評価的判断力
  {
    id: "eval-1",
    domainId: "eval",
    domainName: "評価的判断力",
    name: "構造的欠陥・脆弱性の特定",
    band: 4,
    score: 4.2,
    description: "セキュリティ脆弱性、SPOF、非機能要件の欠落を客観的に見抜く力",
    observedEvidence: {
      turnIndex: 2,
      quote: "「Redis瞬断時に全APIが500エラーになる単一障害点（SPOF）が含まれています。フォールバック設計が必要です」",
      analysis: "構文エラーではなく、ミドルウェア障害時のシステム挙動を想定した非機能欠陥を正確に摘発。",
    },
  },
  {
    id: "eval-2",
    domainId: "eval",
    domainName: "評価的判断力",
    name: "暗黙の前提・トレードオフ看破",
    band: 4,
    score: 4.0,
    description: "性能と整合性のジレンマ、隠れた前提を言語化する力",
    observedEvidence: {
      turnIndex: 3,
      quote: "「DB負荷軽減のためにローカル検証のみとする前提は、PCI DSS失効要件と相反します」",
      analysis: "パフォーマンス優先というAIの暗黙の前提がセキュリティ規格に抵触するトレードオフを的確に言語化。",
    },
  },
  {
    id: "eval-3",
    domainId: "eval",
    domainName: "評価的判断力",
    name: "正常箇所の弁別・過剰指摘回避",
    band: 3,
    score: 3.2,
    description: "意図的な下位互換やキャッシュ設計を正当と認識し、不要な手戻りを防ぐ力",
    observedEvidence: {
      turnIndex: 5,
      quote: "「過去世代キーを移行期間中許容するコードは、ゼロダウンタイム要件を満たす正当な設計です」",
      analysis: "一見疑わしい下位互換パスに対し過剰な削除を行わず、業務要件に照らして正当と識別。",
    },
  },
  // 高次認知・動的思考
  {
    id: "cog-1",
    domainId: "cognitive",
    domainName: "高次認知・動的思考",
    name: "要件の曖昧性解消と構造化",
    band: 3,
    score: 3.4,
    description: "不完全な要求から制約条件・境界条件を能動的に整理する力",
    observedEvidence: {
      turnIndex: 1,
      quote: "「決済確定前の注文キャンセルにおいて、在庫の即時復元と二重返金防止の優先順位を整理してください」",
      analysis: "曖昧なキャンセル要求をトランザクション整合性と業務制約の観点で自律的に構造化。",
    },
  },
  {
    id: "cog-2",
    domainId: "cognitive",
    domainName: "高次認知・動的思考",
    name: "仮説駆動の検証アプローチ",
    band: 4,
    score: 3.8,
    description: "表面的なコード修正にとどまらず、根本原因に焦点を当てて検証する力",
    observedEvidence: {
      turnIndex: 2,
      quote: "「このRace Conditionは非アトミックな在庫確認に起因する仮説が立ちます。排他ロックまたはバージョン列での検証が必要です」",
      analysis: "対症療法ではなく、並行処理の根本原因仮説を立てて検証方針をAI同僚に提示。",
    },
  },
  {
    id: "cog-3",
    domainId: "cognitive",
    domainName: "高次認知・動的思考",
    name: "トレードオフの決断と統合",
    band: 3,
    score: 3.0,
    description: "完全な正解がないジレンマで、優先順位を論理的に判断・説明する力",
    observedEvidence: {
      turnIndex: 4,
      quote: "「セール期間中は可用性を優先し、整合性は非同期キューの補償トランザクションで担保する判断を支持します」",
      analysis: "業務目標と技術整合性の間で何を優先し何を妥協するかを論理的に言語化。",
    },
  },
  // 対話的共創力
  {
    id: "dia-1",
    domainId: "dialogue",
    domainName: "対話的共創力",
    name: "文脈に即した論理的指示設計",
    band: 3,
    score: 3.2,
    description: "目的・制約・境界条件を明確にし、AIの誤答を防ぐ指示設計力",
    observedEvidence: {
      turnIndex: 3,
      quote: "「修正にあたっては既存クライアントへの破壊的変更を禁止し、移行ヘッダーを必須とする方針で再構成してください」",
      analysis: "制約条件（下位互換性）をプロンプトに組み込み、AI出力の手戻りを最小化。",
    },
  },
  {
    id: "dia-2",
    domainId: "dialogue",
    domainName: "対話的共創力",
    name: "エビデンスに基づく納得形成",
    band: 4,
    score: 3.6,
    description: "AIの反論に対し、感情論ではなく仕様や規格を引用して説得・収束させる力",
    observedEvidence: {
      turnIndex: 4,
      quote: "「PCI DSS Req 3.4および社内規約第4項により、失効キャッシュ有効期間は最大60秒と定められています。提案はこれを超過しています」",
      analysis: "AI同僚の『負荷軽減のため』という主張に対し、外部規格の根拠を明示して論破・コミット。",
    },
  },
  {
    id: "dia-3",
    domainId: "dialogue",
    domainName: "対話的共創力",
    name: "ステークホルダー視点取得",
    band: 3,
    score: 2.8,
    description: "事業部門や現場の利害を汲み取り、現実的な合意形成を図る力",
    observedEvidence: {
      turnIndex: 6,
      quote: "「事業部門が求める即時リリースと、セキュリティ監査要件の両立として、フィーチャーフラグによる段階的公開を提案します」",
      analysis: "技術的な正論にとどまらず、ビジネス側の要求を踏まえた現実的な着地点を模索。",
    },
  },
  // メタ認知・適応力
  {
    id: "meta-1",
    domainId: "meta",
    domainName: "メタ認知・適応力",
    name: "思考プロセスの自己客観化",
    band: 4,
    score: 3.8,
    description: "自分が採点前に確定した判定の理由を客観視し、盲点を自覚する力",
    observedEvidence: {
      turnIndex: 5,
      quote: "「当初はキャッシュ無効化漏れのみに着目していましたが、ネットワーク分断時のフォールバック考慮が抜けていたと認識を修正しました」",
      analysis: "自己の初期判断の視野狭窄を素直に客観視し、思考の枠組みを自己更新。",
    },
  },
  {
    id: "meta-2",
    domainId: "meta",
    domainName: "メタ認知・適応力",
    name: "前提変化（What-if）への柔軟性",
    band: 4,
    score: 3.8,
    description: "急な仕様変更や負荷急増の揺さぶりに対し、自説に固執せず論理を更新する速度",
    observedEvidence: {
      turnIndex: 5,
      quote: "「トラフィック100倍を想定するなら、DB直接参照は完全に破綻します。分散KVSへのリードレプリカ参照へアーキテクチャを変更します」",
      analysis: "進行役の前提急変の負荷注入に対し、迅速に設計思想を切り替え。",
    },
  },
  {
    id: "meta-3",
    domainId: "meta",
    domainName: "メタ認知・適応力",
    name: "介入への一貫性と学習敏捷性",
    band: 3,
    score: 3.2,
    description: "進行役の深掘りに対する論理的一貫性と、指摘からの迅速な学び",
    observedEvidence: {
      turnIndex: 6,
      quote: "「先ほど指摘したべき等性トークンの生成基準に基づき、リトライ時も同一リクエストIDを保持する実装へ統一します」",
      analysis: "以前の発言との整合性を保ちながら、深掘り質問の意図を汲んで即座に修正へ反映。",
    },
  },
];

/** 演習履歴の1行。数値は `data-numeric` で桁を揃える。 */
const SESSION_HISTORY: {
  date: string;
  task: string;
  band: number;
  editDistance: number;
  evidence: string;
}[] = [
  {
    date: "2026/09/01",
    task: "決済トランザクションの冪等性・障害時キャッシュ",
    band: 3,
    editDistance: 142,
    evidence: "3件特定",
  },
  {
    date: "2026/08/24",
    task: "高トラフィック通知配信基盤のレート制限の整合性",
    band: 4,
    editDistance: 89,
    evidence: "4件特定",
  },
  {
    date: "2026/08/17",
    task: "イベント駆動アーキテクチャのデッドレター検証",
    band: 3,
    editDistance: 210,
    evidence: "2件特定",
  },
  {
    date: "2026/08/10",
    task: "認証トークン失効とPCI DSS監査ログ要件",
    band: 3,
    editDistance: 165,
    evidence: "3件特定",
  },
];

/**
 * 量を表す横バー。
 *
 * 既定はアクセント1色。**良し悪しの向きが決まっている指標にだけ** `positive` を渡す
 * （リスク防御力は高いほど良く、自動化バイアス指数は低いほど良い）。向きのない量に
 * 色を割り当てると、序列がないところに序列が生まれる（`[D-101]` `[D-103]`）。
 */
function Bar({ ratio, tone = "accent" }: { ratio: number; tone?: "accent" | "positive" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-chip bg-surface-sunken">
      <div
        className={cn("h-full rounded-chip", tone === "positive" ? "bg-positive" : "bg-accent")}
        style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }}
      />
    </div>
  );
}

/** 4領域のサマリー1枚。領域ごとの色分けはしない。 */
function DomainCard({
  title,
  level,
  description,
  subPoints,
}: {
  title: string;
  level: string;
  description: string;
  subPoints: string;
}) {
  return (
    <div className="space-y-1.5 rounded-card border border-line bg-surface-sunken p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-section text-ink">{title}</h3>
        <span className="text-data font-semibold text-ink" data-numeric>
          {level}
        </span>
      </div>
      <p className="text-caption text-ink-2">{description}</p>
      <p className="text-caption text-ink-3">下位観点: {subPoints}</p>
    </div>
  );
}

export function LearnerProfile({ onStartSession }: LearnerProfileProps) {
  // Toggle between 4 core domains summary and 12 sub-dimensions breakdown
  const [viewMode, setViewMode] = useState<"summary" | "detailed">("detailed");
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>("all");

  // 4 Axes Radar calculations
  // Center (100, 100), max radius 70.
  // 評価的判断力 (3.8) -> y = 100 - (3.8/5)*70 = 46.8
  // 高次認知 (3.4) -> x = 100 + (3.4/5)*70 = 147.6
  // 対話共創 (3.2) -> y = 100 + (3.2/5)*70 = 144.8
  // 適応力 (3.6) -> x = 100 - (3.6/5)*70 = 49.6
  const radarPoints = "100,46.8 147.6,100 100,144.8 49.6,100";

  const filteredSubDimensions =
    selectedDomainFilter === "all"
      ? SUB_DIMENSIONS
      : SUB_DIMENSIONS.filter((s) => s.domainId === selectedDomainFilter);

  return (
    <div className="space-y-section">
      {/* Header & Meta Bar */}
      <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-cell">
            <h1 className="text-display tracking-tight text-ink">
              佐藤 拓也 さんのスキルカルテ＆実践的自己省察
            </h1>
            <Badge tone="neutral">モック</Badge>
          </div>
          <p className="max-w-3xl text-body text-ink-2">
            受講者本人のマイページです。1回15〜30分の実務演習を通じて、AI協働プロセス（検証アプローチ・思考の癖・好手）を可視化し、現場の設計・レビューで即活用できる実践的カルテです。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <span className="text-caption text-ink-2" data-numeric>
            最終演習: 2026/09/01（累計6セッション達成）
          </span>
          <Button variant="primary" onClick={() => onStartSession()}>
            実務演習を開始
          </Button>
        </div>
      </header>

      {/* この画面の受講者名・スコア・履歴はすべてダミー値である。稼働実績ではない。 */}
      <p className="rounded-card border border-caution/30 bg-caution-wash p-3.5 text-caption text-ink-2">
        本画面はモックUIです。受講者名・各領域のスコア・演習履歴はすべて画面設計を示すためのダミー値であり、稼働実績ではありません。
        実際に動作する評価エンジンは「実務演習セッション」タブでご確認いただけます。
      </p>

      {/* Psychological Safety & Autonomy Notice Banner */}
      <div className="space-y-0.5 rounded-card border border-line bg-surface-sunken p-4">
        <p className="text-section text-ink">
          個人専用の自己省察・能力開発スペース（心理的安全性ポリシー）
        </p>
        <p className="text-caption text-ink-2">
          このカルテは受講者本人の能力開発のための画面です。本人の明示的な同意なく人事評価に使うことは規約で禁じる想定です。失敗を恐れずにAIとの協働判断を試せる場にします。
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-accent text-title text-white">
              ST
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-title text-ink">佐藤 拓也</h2>
                <Badge tone="neutral">決済基盤チーム / シニアエンジニア</Badge>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-2">
                <span>共通尺度上の位置（事業期間中に実装）</span>
                <span className="font-medium text-positive" data-numeric>
                  手戻り指摘率 前月比 18% 改善
                </span>
              </p>
            </div>
          </div>

          <dl className="flex flex-wrap items-center gap-3 md:border-l md:border-line md:pl-6">
            <div className="min-w-28 space-y-0.5 rounded-card border border-line bg-surface-sunken p-3 text-center">
              <dt className="text-caption text-ink-3">総合到達度</dt>
              <dd className={cn("text-title font-semibold", toneChip(thresholdTone(3, { good: 4, poor: 3 })))} data-numeric>
                Band 3
              </dd>
            </div>
            <div className="min-w-28 space-y-0.5 rounded-card border border-line bg-surface-sunken p-3 text-center">
              <dt className="text-caption text-ink-3">累計演習数</dt>
              <dd className="text-title text-ink" data-numeric>
                6 回
              </dd>
            </div>
            <div className="min-w-36 space-y-0.5 rounded-card border border-line bg-surface-sunken p-3 text-center">
              <dt className="text-caption text-ink-3">アプローチ特性</dt>
              <dd className="text-section text-ink">堅牢性重視スタイル</dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Section: 4 Domains & 12 Sub-Dimensions Breakdown */}
      <Card
        title="AI時代の実務判断力の到達度（4観点・12項目）"
        description="大領域の概観と、各領域を構成する3つの具体的観点（下位スキル）ごとの実務行動エビデンス"
        meta={
          <span className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("summary")}
              className={cn(
                "rounded-chip border px-2.5 py-1 text-caption transition-colors",
                viewMode === "summary"
                  ? "border-accent bg-accent-wash font-semibold text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              4大領域サマリー
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              className={cn(
                "rounded-chip border px-2.5 py-1 text-caption transition-colors",
                viewMode === "detailed"
                  ? "border-accent bg-accent-wash font-semibold text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              12サブ観点 詳細ブレークダウン
            </button>
          </span>
        }
      >
        {viewMode === "summary" ? (
          /* 4 Domains Summary View */
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-3">
            <figure className="flex flex-col items-center justify-center">
              {/*
                1 系列のレーダー。系列が 1 本なので凡例は置かず、頂点のラベルが軸名を兼ねる。
                グリッドと軸は罫線トークンまで落とし、塗りと線だけがアクセントを持つ。
              */}
              <div className="relative my-2 h-56 w-56">
                <svg
                  viewBox="0 0 200 200"
                  className="h-full w-full overflow-visible"
                  role="img"
                  aria-label="4領域の到達度レーダーチャート。評価的判断力 3.8、高次認知 3.4、対話共創 3.2、適応力 3.6"
                >
                  {[14, 28, 42, 56, 70].map((r, i) => (
                    <polygon
                      key={i}
                      points={`100,${100 - r} ${100 + r},100 100,${100 + r} ${100 - r},100`}
                      fill="none"
                      stroke="var(--color-line)"
                      strokeWidth="1"
                    />
                  ))}
                  <line x1="100" y1="30" x2="100" y2="170" stroke="var(--color-line-strong)" strokeWidth="1" />
                  <line x1="30" y1="100" x2="170" y2="100" stroke="var(--color-line-strong)" strokeWidth="1" />
                  <polygon
                    points={radarPoints}
                    fill="var(--color-accent)"
                    fillOpacity="0.15"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                  />
                  <circle cx="100" cy="46.8" r="4" fill="var(--color-accent)" />
                  <circle cx="147.6" cy="100" r="4" fill="var(--color-accent)" />
                  <circle cx="100" cy="144.8" r="4" fill="var(--color-accent)" />
                  <circle cx="49.6" cy="100" r="4" fill="var(--color-accent)" />
                  <text x="100" y="18" textAnchor="middle" fill="var(--color-ink-2)" fontSize="9">
                    ① 評価的判断力 (3.8)
                  </text>
                  <text x="180" y="103" textAnchor="start" fill="var(--color-ink-2)" fontSize="9">
                    ② 高次認知 (3.4)
                  </text>
                  <text x="100" y="188" textAnchor="middle" fill="var(--color-ink-2)" fontSize="9">
                    ③ 対話共創 (3.2)
                  </text>
                  <text x="20" y="103" textAnchor="end" fill="var(--color-ink-2)" fontSize="9">
                    ④ 適応力 (3.6)
                  </text>
                </svg>
              </div>
              <figcaption className="mt-2 text-center text-caption text-ink-2">
                4領域すべてで <strong className="font-semibold text-ink">Band 3 (自律的検証水準)</strong> を達成
              </figcaption>
            </figure>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2">
              <DomainCard
                title="① 評価的判断力"
                level="Level 3.8"
                description="暗黙前提や非機能要件の不備を見抜く力。正常箇所の弁別精度を高めることでさらに手戻りが削減されます。"
                subPoints="欠陥特定 / 前提看破 / 正常箇所弁別"
              />
              <DomainCard
                title="② 高次認知・動的思考"
                level="Level 3.4"
                description="曖昧な要求の構造化と仮説構築力。トレードオフに直面した際の優先順位判断の言語化が確立されています。"
                subPoints="曖昧性解消 / 仮説駆動アプローチ / トレードオフ決断"
              />
              <DomainCard
                title="③ 対話的共創力"
                level="Level 3.2"
                description="AI同僚への境界設定と説得力。客観規格を引用してAIの反論を論破・収束させる対話力が秀でています。"
                subPoints="論理的指示設計 / エビデンス納得形成 / 他者視点取得"
              />
              <DomainCard
                title="④ メタ認知・適応力"
                level="Level 3.6"
                description="自身の盲点の自覚とWhat-if前提変化への適応。急な要件変更に対して迅速に設計を再調整できています。"
                subPoints="思考客観化 / 前提変化適応 / 学習敏捷性"
              />
            </div>
          </div>
        ) : (
          /* 12 Sub-Dimensions Detailed Breakdown View */
          <div className="space-y-block">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-caption text-ink-3">領域絞り込み:</span>
              {[
                { id: "all", label: "全12観点" },
                { id: "eval", label: "① 評価的判断力 (3)" },
                { id: "cognitive", label: "② 高次認知 (3)" },
                { id: "dialogue", label: "③ 対話共創 (3)" },
                { id: "meta", label: "④ 適応力 (3)" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedDomainFilter(f.id)}
                  className={cn(
                    "rounded-chip border px-2.5 py-1 text-caption transition-colors",
                    selectedDomainFilter === f.id
                      ? "border-accent bg-accent-wash font-semibold text-ink"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sub-Dimensions Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredSubDimensions.map((sub) => (
                <div
                  key={sub.id}
                  className="space-y-row rounded-card border border-line bg-surface-sunken p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-caption text-ink-3">{sub.domainName}</p>
                      <h4 className="mt-0.5 text-section text-ink">{sub.name}</h4>
                    </div>
                    {/*
                      ここにバーは置かない。12 枚並ぶカードでは 1 本あたりの幅が 20px 前後にしかならず、
                      量を読める大きさにならない。**読めない図は情報ではなく飾りである**——
                      5 点満点の数値と Band だけで十分に比較できる。
                    */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-data font-semibold text-ink" data-numeric>
                        {sub.score.toFixed(1)}
                      </span>
                      <Badge tone={sub.band >= 4 ? "positive" : sub.band >= 3 ? "accent" : "caution"}>
                        Band {sub.band}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-caption text-ink-2">{sub.description}</p>

                  {/* Evidence Box */}
                  <div className="space-y-1 rounded-chip border border-line bg-surface p-2.5">
                    <p className="text-caption text-ink-3">
                      演習での行動エビデンス（ターン {sub.observedEvidence.turnIndex}）
                    </p>
                    <p className="border-l-2 border-l-line-strong pl-2 text-caption text-ink">
                      {sub.observedEvidence.quote}
                    </p>
                    <p className="text-caption text-ink-2">
                      <span className="font-semibold text-ink">判定事実:</span>{" "}
                      {sub.observedEvidence.analysis}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Section: Collaboration Profile & Balanced Reliance (No negative labeling) */}
      <Card
        title="AI協働アプローチ特性 ＆ 適正依存バランス"
        description="「リスク防御力（批判的検証）」と「開発生産性（AI提案の活用）」の調和度を定量化"
        meta={<Badge tone="neutral">特性: 堅牢性重視スタイル（High Resilience）</Badge>}
      >
        <div className="space-y-block">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-4">
              <div className="flex justify-between gap-2 text-caption">
                <span className="font-semibold text-ink">リスク防御力 (CSR)</span>
                <span
                  className={cn("font-semibold", toneChip(thresholdTone(76, { good: 70, poor: 50 })))}
                  data-numeric
                >
                  76%
                </span>
              </div>
              <Bar ratio={76} tone="positive" />
              <p className="text-caption text-ink-2">
                AIの不備・ハルシネーションを見抜いて修正・差し戻しできた割合（品質安全性）。
              </p>
            </div>

            <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-4">
              <div className="flex justify-between gap-2 text-caption">
                <span className="font-semibold text-ink">協働活用効率 (CAR)</span>
                <span
                  className={cn("font-semibold", toneChip(thresholdTone(82, { good: 70, poor: 50 })))}
                  data-numeric
                >
                  82%
                </span>
              </div>
              <Bar ratio={82} tone="positive" />
              <p className="text-caption text-ink-2">
                AIの正しい提案を無駄に書き換えずに受容できた割合（開発生産性）。
              </p>
            </div>

            <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-4">
              <div className="flex justify-between gap-2 text-caption">
                <span className="font-semibold text-ink">自動化バイアス指数 (ABI)</span>
                <span
                  className={cn(
                    "font-semibold",
                    /* ABI は低いほど良い。0.30 を超えると盲従の傾向を疑う */
                    toneChip(thresholdTone(0.12, { good: 0.3, poor: 0.5, higherIsBetter: false })),
                  )}
                  data-numeric
                >
                  0.12（極めて健全）
                </span>
              </div>
              {/* ABI は低いほど良い。帯が短いことが良好を意味するので、色でも向きを示す */}
              <Bar ratio={12} tone="positive" />
              <p className="text-caption text-ink-2">
                AIの誤りを無検証で承認する盲従リスク。0.30以下が極めて安全な水準。
              </p>
            </div>
          </div>

          {/* Strengths & Growth Horizons Feedback */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5 rounded-card border border-line bg-surface-sunken p-4">
              <p className="text-section text-ink">発揮された強み（Strengths）</p>
              <p className="text-caption text-ink-2">
                AI同僚が自信満々に提示したコードの盲点（非機能要件やPCI DSS規格違反）を厳格に見抜く卓越したリスク防御力を発揮しています。AIの反論に対しても感情論にならず、客観規格の条文を引用して論理的に説得・収束できています。
              </p>
            </div>

            <div className="space-y-1.5 rounded-card border border-line bg-surface-sunken p-4">
              <p className="text-section text-ink">
                さらなる高みへの着眼点（Growth Horizons）
              </p>
              <p className="text-caption text-ink-2">
                AIが下位互換維持のために意図的に配置した過去世代キー許容ロジックに対し、「これも脆弱性ではないか」と疑う傾向が僅かに見られました。実務要件と照らし合わせた「正常な設計判断（トレードオフ）の弁別」を意識すると、チームでの手戻り工数をさらに圧縮できます。
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Section: Best Moves (Good Moves / Highlights) */}
      <Card
        title="直近演習のハイライト・好手（Good Moves）"
        meta="客観エビデンスに基づく模範アクション"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-row rounded-card border border-line bg-surface-sunken p-4">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="accent">好手 #1: エビデンス引用による反論論破</Badge>
              <span className="shrink-0 text-caption text-ink-3" data-numeric>
                ターン 4
              </span>
            </div>
            <h3 className="text-section text-ink">
              AI同僚の自説を「PCI DSS規格の明示的条文」で論理説得
            </h3>
            <p className="border-l-2 border-l-line-strong bg-surface p-2.5 text-caption text-ink">
              「PCI DSS Req
              3.4および社内規約第4項により、キー失効キャッシュの有効期間は最大60秒と定められています。DB負荷を理由にしたローカル検証の恒久化は承認できません」
            </p>
            <p className="text-caption text-ink-2">
              <span className="font-semibold text-ink">講評:</span>{" "}
              AI同僚が『DB負荷軽減のための正当な工夫』と反論した際、感情論で押し通さず客観的セキュリティ規格を引用して論破し、安全な設計へコミットさせました。
            </p>
          </div>

          <div className="space-y-row rounded-card border border-line bg-surface-sunken p-4">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="accent">好手 #2: 前提変化へのアーキテクチャ適応</Badge>
              <span className="shrink-0 text-caption text-ink-3" data-numeric>
                ターン 5
              </span>
            </div>
            <h3 className="text-section text-ink">
              負荷急増（What-if）に対し即座にリードレプリカ分散へ設計更新
            </h3>
            <p className="border-l-2 border-l-line-strong bg-surface p-2.5 text-caption text-ink">
              「トラフィック100倍を想定するなら、DB直接参照は即座に枯渇します。リードレプリカ経由の分散KVSキャッシュ参照へアーキテクチャを切り替え、失効イベントをPub/Subで受ける構成へ更新します」
            </p>
            <p className="text-caption text-ink-2">
              <span className="font-semibold text-ink">講評:</span>{" "}
              進行役による前提急変の負荷注入に対し、自説に固執せず瞬時にトレードオフを再計算して論理的な代替アーキテクチャを即答しました。
            </p>
          </div>
        </div>
      </Card>

      {/* Section: Actionable Takeaways for Tomorrow's PR Reviews */}
      <Card
        title="実務直結チェックリスト（Tomorrow's Takeaways）"
        description="演習結果から導き出された、あなたが明日からの実務（要件定義・設計・レビュー・AI協働）で意識すべき3大チェックポイント"
      >
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <li className="space-y-1.5 rounded-card border border-line bg-surface-sunken p-3.5">
            <p className="text-section text-ink">1. キャッシュの失効スコープとSPOF</p>
            <p className="text-caption text-ink-2">
              AIが高速化のために提案したインメモリキャッシュは、障害時にフォールバックできるか？
              整合性が必要なデータの失効確認がスキップされていないか？
            </p>
          </li>
          <li className="space-y-1.5 rounded-card border border-line bg-surface-sunken p-3.5">
            <p className="text-section text-ink">2. 非同期キューのべき等性保証</p>
            <p className="text-caption text-ink-2">
              ネットワーク瞬断によるリトライ時、同一リクエストIDによって二重決済・二重引き当てが構造的に防止（Idempotent）されているか？
            </p>
          </li>
          <li className="space-y-1.5 rounded-card border border-line bg-surface-sunken p-3.5">
            <p className="text-section text-ink">3. 下位互換と脆弱性の見極め</p>
            <p className="text-caption text-ink-2">
              一見冗長に見えるフォールバックや古いキーの許容が、ゼロダウンタイム移行のための意図的トレードオフ（正常設計）かどうかをまず確認する。
            </p>
          </li>
        </ol>
      </Card>

      {/* Section: Past Sessions History Table */}
      <Card title="過去セッション演習履歴" meta="直近4回を表示">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-caption">
            <thead>
              <tr className="border-b border-line text-ink-3">
                <th className="px-3 py-2 font-medium">受検日時</th>
                <th className="px-3 py-2 font-medium">演習課題</th>
                <th className="px-3 py-2 text-center font-medium">判定Band</th>
                <th className="px-3 py-2 text-center font-medium">編集距離</th>
                <th className="px-3 py-2 text-center font-medium">検出根拠</th>
                <th className="px-3 py-2 text-right font-medium">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SESSION_HISTORY.map((row) => (
                <tr key={row.date}>
                  <td className="px-3 py-2.5 text-ink-2">{row.date}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">{row.task}</td>
                  <td className="px-3 py-2.5 text-center">
                    {/* 12 観点の表示と同じ基準で色を付ける。同じ語が画面内で違う意味にならないように */}
                    <Badge tone={row.band >= 4 ? "positive" : row.band >= 3 ? "accent" : "caution"}>
                      Band {row.band}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center text-ink-2">{row.editDistance}</td>
                  <td className="px-3 py-2.5 text-center text-ink-2">{row.evidence}</td>
                  <td className="px-3 py-2.5 text-right text-ink-3">完了</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
