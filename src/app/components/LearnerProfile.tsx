"use client";

import React, { useState } from "react";
import {
  UserCheck,
  Award,
  Calendar,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  History,
  Sparkles,
  Target,
  ShieldCheck,
  Check,
  Quote,
  Sliders,
  Layers,
  Zap,
  TrendingUp,
  FileText,
  Lightbulb,
} from "lucide-react";

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
    description: "自身の暫定判断の理由（CFF）を客観視し、盲点を自覚する力",
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Meta Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <UserCheck className="w-4 h-4" />
            <span>受講者マイページ・スキルカルテ（B2B SaaS 構想モックUI）</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
              Viability
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            佐藤 拓也 さんのスキルカルテ＆実践的自己省察
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
            1回15〜30分の実務演習を通じて、AI協働プロセス（検証アプローチ・思考の癖・好手）を可視化し、現場の設計・レビューで即活用できる実践的カルテです。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>最終演習: 2026/09/01（累計6セッション達成）</span>
          </div>
          <button
            onClick={() => onStartSession()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <span>実務演習を開始</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* この画面の受講者名・スコア・履歴はすべてダミー値である。稼働実績ではない。 */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-600/30 text-amber-200/90 text-xs flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
        <span>
          本画面はモックUIです。受講者名・各領域のスコア・演習履歴はすべて画面設計を示すためのダミー値であり、稼働実績ではありません。
          実際に動作する評価エンジンは「実務演習セッション」タブでご確認いただけます。
        </span>
      </div>

      {/* Psychological Safety & Autonomy Notice Banner */}
      <div className="p-4 rounded-xl bg-indigo-950/25 border border-indigo-500/30 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-indigo-200 block mb-0.5 font-semibold">
            🛡️ 個人専用の自己省察・能力開発スペース（心理的安全性ポリシー）
          </strong>
          本カルテは受講者本人の能力開発・自己研鑽のために提供されています。他者との社内ランキングや序列比較は一切行われず、本人の明示的同意のない人事評価への流用も規約上禁止されています。安全な環境で、失敗を恐れずAIとの協働判断を試行錯誤できます。
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20 shrink-0">
            ST
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">佐藤 拓也</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                決済基盤チーム / シニアエンジニア
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                IRT尺度 較正済み（共通アンカー受検済）
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-300 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                手戻り指摘率 前月比 18% 改善
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:border-l md:border-slate-800 md:pl-6">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-28">
            <span className="text-[11px] text-slate-400 block">総合到達度</span>
            <span className="text-lg font-bold text-blue-400 font-mono mt-0.5 block">
              Band 3
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-28">
            <span className="text-[11px] text-slate-400 block">累計演習数</span>
            <span className="text-lg font-bold text-white font-mono mt-0.5 block">
              6 回
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center min-w-36">
            <span className="text-[11px] text-slate-400 block">アプローチ特性</span>
            <span className="text-xs font-bold text-emerald-400 mt-1 block">
              堅牢性重視スタイル
            </span>
          </div>
        </div>
      </div>

      {/* Section: 4 Domains & 12 Sub-Dimensions Breakdown */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                動的コンピテンシー到達度（4領域・12サブ観点）
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              大領域の概観と、各領域を構成する3つの具体的観点（下位スキル）ごとの実務行動エビデンス
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode("summary")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "summary"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              4大領域サマリー
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "detailed"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              12サブ観点 詳細ブレークダウン
            </button>
          </div>
        </div>

        {viewMode === "summary" ? (
          /* 4 Domains Summary View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="flex flex-col items-center justify-center p-4">
              <div className="relative w-56 h-56 my-2">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                  {[14, 28, 42, 56, 70].map((r, i) => (
                    <polygon
                      key={i}
                      points={`100,${100 - r} ${100 + r},100 100,${100 + r} ${100 - r},100`}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                  ))}
                  <line x1="100" y1="30" x2="100" y2="170" stroke="#334155" strokeWidth="1" />
                  <line x1="30" y1="100" x2="170" y2="100" stroke="#334155" strokeWidth="1" />
                  <polygon
                    points={radarPoints}
                    fill="rgba(99, 102, 241, 0.25)"
                    stroke="#818cf8"
                    strokeWidth="2.5"
                  />
                  <circle cx="100" cy="46.8" r="4" fill="#38bdf8" />
                  <circle cx="147.6" cy="100" r="4" fill="#818cf8" />
                  <circle cx="100" cy="144.8" r="4" fill="#a855f7" />
                  <circle cx="49.6" cy="100" r="4" fill="#34d399" />
                  <text x="100" y="18" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                    ① 評価的判断力 (3.8)
                  </text>
                  <text x="180" y="103" textAnchor="start" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                    ② 高次認知 (3.4)
                  </text>
                  <text x="100" y="188" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                    ③ 対話共創 (3.2)
                  </text>
                  <text x="20" y="103" textAnchor="end" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                    ④ 適応力 (3.6)
                  </text>
                </svg>
              </div>
              <span className="text-[11px] text-slate-400 text-center mt-2">
                4領域すべてで <strong className="text-white">Band 3 (自律的検証水準)</strong> を達成
              </span>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    ① 評価的判断力
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-400">Level 3.8</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  暗黙前提や非機能要件の不備を見抜く力。正常箇所の弁別精度を高めることでさらに手戻りが削減されます。
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  下位観点: 欠陥特定 / 前提看破 / 正常箇所弁別
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-400" />
                    ② 高次認知・動的思考
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-400">Level 3.4</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  曖昧な要求の構造化と仮説構築力。トレードオフに直面した際の優先順位判断の言語化が確立されています。
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  下位観点: 曖昧性解消 / 仮説駆動アプローチ / トレードオフ決断
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    ③ 対話的共創力
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-400">Level 3.2</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  AI同僚への境界設定と説得力。客観規格を引用してAIの反論を論破・収束させる対話力が秀でています。
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  下位観点: 論理的指示設計 / エビデンス納得形成 / 他者視点取得
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    ④ メタ認知・適応力
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">Level 3.6</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  自身の盲点の自覚とWhat-if前提変化への適応。急な要件変更に対して迅速に設計を再調整できています。
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  下位観点: 思考客観化 / 前提変化適応 / 学習敏捷性
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 12 Sub-Dimensions Detailed Breakdown View */
          <div className="space-y-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                <Sliders className="w-3.5 h-3.5" />
                領域絞り込み:
              </span>
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
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                    selectedDomainFilter === f.id
                      ? "bg-slate-800 text-white border border-indigo-500/50 font-semibold"
                      : "bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sub-Dimensions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSubDimensions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        {sub.domainName}
                      </span>
                      <h4 className="text-xs font-bold text-white mt-0.5">
                        {sub.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono font-bold text-blue-400">
                        {sub.score.toFixed(1)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px] border border-blue-500/30">
                        Band {sub.band}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      style={{ width: `${(sub.score / 5) * 100}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {sub.description}
                  </p>

                  {/* Evidence Box */}
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                      <Quote className="w-3 h-3 text-indigo-400" />
                      <span>演習での行動エビデンス（ターン {sub.observedEvidence.turnIndex}）</span>
                    </div>
                    <p className="text-slate-200 font-mono text-[10.5px] italic">
                      {sub.observedEvidence.quote}
                    </p>
                    <p className="text-slate-400 text-[10.5px] pt-0.5">
                      ↳ <span className="text-indigo-300">判定事実:</span> {sub.observedEvidence.analysis}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section: Collaboration Profile & Balanced Reliance (No negative labeling) */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                AI協働アプローチ特性 ＆ 適正依存バランス
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              「リスク防御力（批判的検証）」と「開発生産性（AI提案の活用）」の調和度を定量化
            </p>
          </div>

          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold self-start sm:self-auto">
            特性: 堅牢性重視スタイル（High Resilience）
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Metric 1 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">リスク防御力 (CSR)</span>
              <span className="font-mono text-emerald-400 font-bold">76%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-[76%]" />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              AIの不備・ハルシネーションを見抜いて修正・差し戻しできた割合（品質安全性）。
            </p>
          </div>

          {/* Metric 2 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">協働活用効率 (CAR)</span>
              <span className="font-mono text-blue-400 font-bold">82%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full w-[82%]" />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              AIの正しい提案を無駄に書き換えずに受容できた割合（開発生産性）。
            </p>
          </div>

          {/* Metric 3 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">自動化バイアス指数 (ABI)</span>
              <span className="font-mono text-emerald-400 font-bold">0.12 (極めて健全)</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-[12%]" />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              AIの誤りを無検証で承認する盲従リスク。0.30以下が極めて安全な水準。
            </p>
          </div>
        </div>

        {/* Strengths & Growth Horizons Feedback */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>発揮された強み（Strengths）</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              AI同僚が自信満々に提示したコードの盲点（非機能要件やPCI DSS規格違反）を厳格に見抜く卓越したリスク防御力を発揮しています。AIの反論に対しても感情論にならず、客観規格の条文を引用して論理的に説得・収束できています。
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 text-blue-300 font-bold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>さらなる高みへの着眼点（Growth Horizons）</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              AIが下位互換維持のために意図的に配置した過去世代キー許容ロジックに対し、「これも脆弱性ではないか」と疑う傾向が僅かに見られました。実務要件と照らし合わせた「正常な設計判断（トレードオフ）の弁別」を意識すると、チームでの手戻り工数をさらに圧縮できます。
            </p>
          </div>
        </div>
      </div>

      {/* Section: Best Moves (Good Moves / Highlights) */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              直近演習のハイライト・好手（Good Moves）
            </h2>
          </div>
          <span className="text-xs text-slate-400">客観エビデンスに基づく模範アクション</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Highlight Move 1 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                🌟 好手 #1: エビデンス引用による反論論破
              </span>
              <span className="text-[10px] text-slate-400 font-mono">ターン 4</span>
            </div>
            <h3 className="text-xs font-bold text-white">
              AI同僚の自説を「PCI DSS規格の明示的条文」で論理説得
            </h3>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 italic">
              「PCI DSS Req 3.4および社内規約第4項により、キー失効キャッシュの有効期間は最大60秒と定められています。DB負荷を理由にしたローカル検証の恒久化は承認できません」
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-amber-300 font-semibold">講評:</span> AI同僚が『DB負荷軽減のための正当な工夫』と反論した際、感情論で押し通さず客観的セキュリティ規格を引用して論破し、安全な設計へコミットさせました。
            </p>
          </div>

          {/* Highlight Move 2 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                🌟 好手 #2: 前提変化へのアーキテクチャ適応
              </span>
              <span className="text-[10px] text-slate-400 font-mono">ターン 5</span>
            </div>
            <h3 className="text-xs font-bold text-white">
              負荷急増（What-if）に対し即座にリードレプリカ分散へ設計更新
            </h3>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 italic">
              「トラフィック100倍を想定するなら、DB直接参照は即座に枯渇します。リードレプリカ経由の分散KVSキャッシュ参照へアーキテクチャを切り替え、失効イベントをPub/Subで受ける構成へ更新します」
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-indigo-300 font-semibold">講評:</span> 進行役による前提急変の負荷注入に対し、自説に固執せず瞬時にトレードオフを再計算して論理的な代替アーキテクチャを即答しました。
            </p>
          </div>
        </div>
      </div>

      {/* Section: Actionable Takeaways for Tomorrow's PR Reviews */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            実務直結チェックリスト（Tomorrow&apos;s Takeaways）
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          演習結果から導き出された、あなたが明日からの実務（要件定義・設計・レビュー・AI協働）で意識すべき3大チェックポイント
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>1. キャッシュの失効スコープとSPOF</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              AIが高速化のために提案したインメモリキャッシュは、障害時にフォールバックできるか？ 整合性が必要なデータの失効確認がスキップされていないか？
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>2. 非同期キューのべき等性保証</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              ネットワーク瞬断によるリトライ時、同一リクエストIDによって二重決済・二重引き当てが構造的に防止（Idempotent）されているか？
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>3. 下位互換と脆弱性の見極め</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              一見冗長に見えるフォールバックや古いキーの許容が、ゼロダウンタイム移行のための意図的トレードオフ（正常設計）かどうかをまず確認する。
            </p>
          </div>
        </div>
      </div>

      {/* Section: Past Sessions History Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              過去セッション演習履歴
            </h2>
          </div>
          <span className="text-xs text-slate-400">直近4回を表示</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase">
                <th className="py-2.5 px-3">受検日時</th>
                <th className="py-2.5 px-3">演習課題</th>
                <th className="py-2.5 px-3 text-center">判定Band</th>
                <th className="py-2.5 px-3 text-center">編集距離</th>
                <th className="py-2.5 px-3 text-center">検出根拠</th>
                <th className="py-2.5 px-3 text-right">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-3 text-slate-400 font-mono">2026/09/01</td>
                <td className="py-3 px-3 font-semibold text-slate-200">
                  [T-06a] 決済トランザクションの冪等性・障害時キャッシュ
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    Band 3
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono text-slate-400">142</td>
                <td className="py-3 px-3 text-center text-emerald-400 font-semibold">3件特定</td>
                <td className="py-3 px-3 text-right text-slate-400">完了</td>
              </tr>

              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-3 text-slate-400 font-mono">2026/08/24</td>
                <td className="py-3 px-3 font-semibold text-slate-200">
                  [T-06b] 高トラフィック通知配信基盤のRate Limit整合性
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Band 4
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono text-slate-400">89</td>
                <td className="py-3 px-3 text-center text-emerald-400 font-semibold">4件特定</td>
                <td className="py-3 px-3 text-right text-slate-400">完了</td>
              </tr>

              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-3 text-slate-400 font-mono">2026/08/17</td>
                <td className="py-3 px-3 font-semibold text-slate-200">
                  [T-06c] イベント駆動アーキテクチャのデッドレター検証
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    Band 3
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono text-slate-400">210</td>
                <td className="py-3 px-3 text-center text-emerald-400 font-semibold">2件特定</td>
                <td className="py-3 px-3 text-right text-slate-400">完了</td>
              </tr>

              <tr className="hover:bg-slate-800/30">
                <td className="py-3 px-3 text-slate-400 font-mono">2026/08/10</td>
                <td className="py-3 px-3 font-semibold text-slate-200">
                  [T-05] 認証トークン失効とPCI DSS監査ログ要件
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    Band 3
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono text-slate-400">165</td>
                <td className="py-3 px-3 text-center text-emerald-400 font-semibold">3件特定</td>
                <td className="py-3 px-3 text-right text-slate-400">完了</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
