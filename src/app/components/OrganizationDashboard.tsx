"use client";

import React, { useState } from "react";
import {
  Building2,
  Users,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Sparkles,
  Filter,
  Info,
  ChevronRight,
  TrendingDown,
  Search,
  Download,
  FileText,
  Clock,
  Send,
  AlertCircle,
  Award,
  ExternalLink,
} from "lucide-react";

interface OrganizationDashboardProps {
  onStartSession: () => void;
  onViewLearnerProfile?: (learnerId?: string) => void;
  onViewBenchmarkGallery?: (taskId?: string) => void;
}

export interface LearnerItem {
  id: string;
  name: string;
  role: string;
  team: string;
  progress: {
    completed: number;
    total: number;
  };
  lastActive: string;
  overallBand: number;
  initialBand: number;
  scores: {
    epistemic: number; // ① 評価的判断力
    metacognition: number; // ② 高次認知
    dialogue: number; // ③ 対話共創
    adaptation: number; // ④ 適応力
  };
  biasStatus: "overcome" | "improving" | "needs_focus";
  biasLabel: string;
  biasNote: string;
  status: "active" | "completed" | "stalled";
}

interface TeamSummary {
  name: string;
  memberCount: number;
  completionRate: number;
  activeRate: number;
  avgHours: number;
  note: string;
}

const LEARNERS_DATA: LearnerItem[] = [
  {
    id: "learner-01",
    name: "佐藤 拓也",
    role: "シニアエンジニア",
    team: "決済基盤チーム",
    progress: { completed: 12, total: 12 },
    lastActive: "2026-09-05",
    overallBand: 3.8,
    initialBand: 2.3,
    scores: { epistemic: 4.1, metacognition: 3.8, dialogue: 3.5, adaptation: 3.9 },
    biasStatus: "overcome",
    biasLabel: "盲従克服済み（自律批判型）",
    biasNote: "PCI DSS制約やSPOF脆弱性を的確に指摘。AI提案コードの編集・検証が組織内トップクラス。",
    status: "completed",
  },
  {
    id: "learner-02",
    name: "高橋 優斗",
    role: "バックエンドエンジニア",
    team: "コアAPIプラットフォーム",
    progress: { completed: 11, total: 12 },
    lastActive: "2026-09-04",
    overallBand: 3.6,
    initialBand: 2.4,
    scores: { epistemic: 3.7, metacognition: 3.6, dialogue: 3.8, adaptation: 3.3 },
    biasStatus: "overcome",
    biasLabel: "盲従克服済み（対話収束型）",
    biasNote: "キャッシュTTLやレートリミットの整合性検証が安定。What-if前提変化への適応速度が顕著に向上。",
    status: "active",
  },
  {
    id: "learner-03",
    name: "中村 遥",
    role: "インフラエンジニア",
    team: "SRE / インフラチーム",
    progress: { completed: 12, total: 12 },
    lastActive: "2026-09-06",
    overallBand: 4.3,
    initialBand: 3.1,
    scores: { epistemic: 4.5, metacognition: 4.2, dialogue: 4.1, adaptation: 4.4 },
    biasStatus: "overcome",
    biasLabel: "全領域マスター（模範型）",
    biasNote: "前提検証・対話共創・適応力のすべてがBand 4水準。社内コードレビュアー推薦対象。",
    status: "completed",
  },
  {
    id: "learner-04",
    name: "渡辺 健司",
    role: "データエンジニア",
    team: "データ分析基盤チーム",
    progress: { completed: 9, total: 12 },
    lastActive: "2026-08-30",
    overallBand: 3.3,
    initialBand: 2.2,
    scores: { epistemic: 3.5, metacognition: 3.2, dialogue: 3.1, adaptation: 3.4 },
    biasStatus: "improving",
    biasLabel: "過剰指摘の適正化進行中",
    biasNote: "正常コードに対する不信（False Positive指摘）が初期28%から10%へ減少。合意形成力が向上。",
    status: "active",
  },
  {
    id: "learner-05",
    name: "伊藤 菜々子",
    role: "フロントエンドエンジニア",
    team: "モバイル・フロントエンドチーム",
    progress: { completed: 8, total: 12 },
    lastActive: "2026-09-02",
    overallBand: 2.9,
    initialBand: 1.8,
    scores: { epistemic: 2.7, metacognition: 2.8, dialogue: 3.3, adaptation: 2.8 },
    biasStatus: "improving",
    biasLabel: "盲従克服中（検証行動移行期）",
    biasNote: "初期の無検証承認から批判的精査へ移行中。非同期例外・フォールバック検証演習を推奨。",
    status: "active",
  },
  {
    id: "learner-06",
    name: "小林 大樹",
    role: "ジュニアエンジニア",
    team: "モバイル・フロントエンドチーム",
    progress: { completed: 3, total: 12 },
    lastActive: "2026-08-04",
    overallBand: 2.1,
    initialBand: 1.9,
    scores: { epistemic: 2.0, metacognition: 2.1, dialogue: 2.4, adaptation: 1.9 },
    biasStatus: "needs_focus",
    biasLabel: "要受講フォロー（初期AI過信）",
    biasNote: "受講が30日以上停滞。AI出力コードを無検証で承認する傾向あり。上長1on1での動機付け推奨。",
    status: "stalled",
  },
];

const TEAMS_SUMMARY: TeamSummary[] = [
  {
    name: "決済基盤チーム",
    memberCount: 24,
    completionRate: 95.8,
    activeRate: 91.6,
    avgHours: 11.8,
    note: "PCI DSS制約やSPOF検証が組織的に定着。受講習慣が最も高い。",
  },
  {
    name: "コアAPIプラットフォーム",
    memberCount: 38,
    completionRate: 92.1,
    activeRate: 89.5,
    avgHours: 11.2,
    note: "アーキテクチャ設計・非同期耐性の検証演習が順調に進捗。",
  },
  {
    name: "SRE / インフラチーム",
    memberCount: 22,
    completionRate: 100.0,
    activeRate: 95.5,
    avgHours: 12.4,
    note: "全員が既定12セッション修了。What-if耐性で社内最高スコア。",
  },
  {
    name: "データ分析基盤チーム",
    memberCount: 26,
    completionRate: 84.6,
    activeRate: 80.8,
    avgHours: 10.1,
    note: "正常コードへの過剰指摘バイアスが大幅に是正中。",
  },
  {
    name: "モバイル・フロントエンドチーム",
    memberCount: 32,
    completionRate: 75.0,
    activeRate: 71.8,
    avgHours: 8.9,
    note: "一部メンバーに受講停滞あり。非同期例外演習の重点フォロー推奨。",
  },
];

export function OrganizationDashboard({
  onStartSession,
  onViewLearnerProfile,
  onViewBenchmarkGallery,
}: OrganizationDashboardProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeLearner, setActiveLearner] = useState<LearnerItem>(LEARNERS_DATA[0]);
  const [remindSuccess, setRemindSuccess] = useState<boolean>(false);
  const [recommendSuccess, setRecommendSuccess] = useState<boolean>(false);
  const [csvExportSuccess, setCsvExportSuccess] = useState<boolean>(false);

  const filteredLearners = LEARNERS_DATA.filter((learner) => {
    const matchesTeam = selectedTeam === "all" || learner.team === selectedTeam;
    const matchesStatus = selectedStatus === "all" || learner.status === selectedStatus;
    const matchesSearch =
      searchQuery.trim() === "" ||
      learner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      learner.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      learner.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTeam && matchesStatus && matchesSearch;
  });

  const getBandBadgeClass = (score: number) => {
    if (score >= 4.0) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (score >= 3.0) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (score >= 2.5) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-rose-500/15 text-rose-400 border-rose-500/30";
  };

  const getStatusBadge = (status: LearnerItem["status"]) => {
    if (status === "completed") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          <CheckCircle2 className="w-3 h-3" />
          <span>修了済み</span>
        </span>
      );
    }
    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
          <Clock className="w-3 h-3" />
          <span>受講中</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
        <AlertCircle className="w-3 h-3" />
        <span>要フォロー</span>
      </span>
    );
  };

  const handleSendReminder = () => {
    setRemindSuccess(true);
    setTimeout(() => setRemindSuccess(false), 3500);
  };

  const handleSendRecommendation = () => {
    setRecommendSuccess(true);
    setTimeout(() => setRecommendSuccess(false), 3500);
  };

  const handleExportCsv = () => {
    setCsvExportSuccess(true);
    setTimeout(() => setCsvExportSuccess(false), 3500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Meta Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Building2 className="w-4 h-4" />
            <span>企業向け育成・管理ポータル（B2B SaaS 構想モックUI）</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">
              Viability
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            組織・受講管理ダッシュボード
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
            受講者個人の学習進捗と動的コンピテンシー（4領域）の成長推移を一元管理し、
            演習によるバイアス克服成果の実証と、現場マネージャーの育成フォロー（1on1・推奨課題配信）を支援します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>助成金用受講ログCSV</span>
          </button>
          {onViewBenchmarkGallery && (
            <button
              onClick={() => onViewBenchmarkGallery()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/60 text-indigo-200 text-xs font-semibold transition-all"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>エキスパート事後講評</span>
            </button>
          )}
          <button
            onClick={onStartSession}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
          >
            <span>実務演習を直接体験</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Global Notifications / Toasts */}
      {csvExportSuccess && (
        <div className="p-3.5 rounded-xl bg-blue-950/80 border border-blue-700/60 text-blue-200 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              【助成金申請用ログ出力完了】厚生労働省 人材開発支援助成金（リスキリング支援コース）提出用受講時間・出席ログ（142名分・12時間構成CSV）をダウンロードしました。
            </span>
          </div>
        </div>
      )}
      {remindSuccess && (
        <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-700/60 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>受講停滞メンバー（30日以上未受講）へ、Slackおよびメールで演習リマインドを配信しました。</span>
        </div>
      )}
      {recommendSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>非同期エラー検証の強化対象メンバーへ、推奨課題「T-06b（キャッシュ不整合の検知）」を一括配信しました。</span>
        </div>
      )}

      {/*
        この画面に並ぶ受講者・組織の数値はすべてダミー値である。稼働実績ではない。
        本プロトタイプの目的は B2B SaaS としての画面設計（Viability）を示すことであり、
        効果量の測定は採択後の PoC で行う。実際に動く評価エンジンは「実務演習セッション」側にある。
      */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-600/30 text-amber-200/90 text-xs flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
        <span>
          本画面はモックUIです。受講者名・受講状況・各指標はすべて画面設計を示すためのダミー値であり、稼働実績ではありません。
          実際に動作する評価エンジンは「実務演習セッション」タブでご確認いただけます。
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Completion */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>受検完了エンジニア</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">142</span>
            <span className="text-xs text-slate-400">/ 161 名</span>
            <span className="ml-auto inline-flex items-center text-xs text-emerald-400 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              88.2%
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            受講完了率が前期比 +12% 向上。月次演習の定着が進んでいます。
          </p>
        </div>

        {/* Card 2: Average Band Growth */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>組織平均 到達Band</span>
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400 tracking-tight">Band 3.4</span>
            <span className="text-xs text-slate-400">/ 5.0</span>
            <span className="ml-auto inline-flex items-center text-xs text-emerald-400 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +1.1 pt
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            受講開始時の平均 Band 2.3 から「Band 3: 前提・トレードオフ検証」へ向上。
          </p>
        </div>

        {/* Card 3: Bias Overcome Rate */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-indigo-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>盲従バイアス克服率</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-400 tracking-tight">74.2%</span>
            <span className="text-xs text-slate-400">克服</span>
            <span className="ml-auto inline-flex items-center text-xs text-emerald-400 font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              -28.4 pt
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            初回演習時の無検証承認率 38.2% が直近 9.8% まで劇的に解消。
          </p>
        </div>

        {/* Card 4: Study Hours for Subsidy */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-amber-500" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>累計受講・演習時間</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400 tracking-tight">1,704</span>
            <span className="text-xs text-slate-400">時間</span>
            <span className="ml-auto text-xs text-amber-300 font-semibold">
              平均 10.6h / 名
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-snug">
            人材開発支援助成金の10〜12時間訓練要件を 86.4% の受講者が達成。
          </p>
        </div>
      </div>

      {/* Main Section: Learner List Table (2/3 Width) & Growth/Action Panels (1/3 Width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Table: Learner Roster & Skill Profile (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">
                  受講者一覧・スキル到達度カルテ
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                各エンジニアの受講進捗、動的コンピテンシー4領域Band、成長度を確認できます。行をクリックするとカルテ要約を表示します。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">表示:</span>
              <span className="text-xs font-bold font-mono text-white bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                {filteredLearners.length}名
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="氏名・所属・役職で検索..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">すべての部署</option>
                <option value="決済基盤チーム">決済基盤チーム</option>
                <option value="コアAPIプラットフォーム">コアAPIプラットフォーム</option>
                <option value="SRE / インフラチーム">SRE / インフラチーム</option>
                <option value="データ分析基盤チーム">データ分析基盤チーム</option>
                <option value="モバイル・フロントエンドチーム">モバイル・フロントエンドチーム</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">すべての受講状況</option>
                <option value="completed">修了済み（12回）</option>
                <option value="active">受講中（順調）</option>
                <option value="stalled">要フォロー（停滞）</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-3">氏名・所属</th>
                  <th className="py-3 px-2 text-center">進捗</th>
                  <th className="py-3 px-2 text-center">現在Band</th>
                  <th className="py-3 px-2 text-center">① 評価</th>
                  <th className="py-3 px-2 text-center">② 高次</th>
                  <th className="py-3 px-2 text-center">③ 共創</th>
                  <th className="py-3 px-2 text-center">④ 適応</th>
                  <th className="py-3 px-2 text-center">成長</th>
                  <th className="py-3 px-3 text-center">状況</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLearners.map((learner) => (
                  <tr
                    key={learner.id}
                    onClick={() => setActiveLearner(learner)}
                    className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${
                      activeLearner.id === learner.id ? "bg-blue-950/30" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-2">
                          <span>{learner.name}</span>
                          {learner.overallBand >= 4.0 && (
                            <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{learner.team}</span>
                          <span>•</span>
                          <span>{learner.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-xs text-slate-300">
                          {learner.progress.completed} / {learner.progress.total}
                        </span>
                        <div className="w-14 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              learner.progress.completed === learner.progress.total
                                ? "bg-emerald-500"
                                : learner.status === "stalled"
                                ? "bg-rose-500"
                                : "bg-blue-500"
                            }`}
                            style={{
                              width: `${(learner.progress.completed / learner.progress.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono border ${getBandBadgeClass(
                          learner.overallBand
                        )}`}
                      >
                        {learner.overallBand.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-xs text-slate-300">
                      {learner.scores.epistemic.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-xs text-slate-300">
                      {learner.scores.metacognition.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-xs text-slate-300">
                      {learner.scores.dialogue.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-xs text-slate-300">
                      {learner.scores.adaptation.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="text-xs font-mono font-semibold text-emerald-400">
                        +{(learner.overallBand - learner.initialBand).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {getStatusBadge(learner.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected Learner Quick Summary Card */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  選択中: {activeLearner.name} さん
                </span>
                <span className="text-xs text-slate-400">
                  （{activeLearner.team} / {activeLearner.role}）
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                  {activeLearner.biasLabel}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                {activeLearner.biasNote}
              </p>
            </div>

            <button
              onClick={() => {
                if (onViewLearnerProfile) {
                  onViewLearnerProfile(activeLearner.id);
                } else {
                  onStartSession();
                }
              }}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all"
            >
              <span>受講者カルテ詳細を開く</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Side: Efficacy Before/After & Manager Action Recommendations */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* Card A: Bias Overcome & Efficacy (Before vs After) */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  バイアス克服・教育成果（Before / After）
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                ダミー値
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              受講者全員の初期演習（初回〜2回目）と直近演習の比較を想定した画面です。AI出力を批判的に検証する行動の定着を、この形で提示します。
            </p>
            <p className="text-[11px] text-amber-300/80 leading-relaxed border border-amber-500/20 bg-amber-500/5 rounded-lg px-3 py-2">
              本カードの数値は画面設計を示すためのダミー値であり、実測値ではありません。効果量の測定は採択後のPoCで行います。
            </p>

            <div className="space-y-3.5 pt-1">
              {/* Metric 1: AI Over-reliance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">AI盲従（無検証即時承認率）</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    38.2% → 9.8% (-28.4 pt)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  <div className="h-full bg-rose-500/80 w-[38%]" title="初回 38.2%" />
                  <div className="h-full bg-slate-800 flex-1" />
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 w-[9.8%]" title="直近 9.8%" />
                  <div className="h-full bg-slate-800 flex-1" />
                </div>
              </div>

              {/* Metric 2: Excessive Nitpicking */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">正常コード過剰指摘率（手戻り要因）</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    27.5% → 11.2% (-16.3 pt)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  <div className="h-full bg-amber-500/80 w-[27.5%]" />
                  <div className="h-full bg-slate-800 flex-1" />
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 w-[11.2%]" />
                  <div className="h-full bg-slate-800 flex-1" />
                </div>
              </div>

              {/* Metric 3: Proper Verification Rate */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">適切差し戻し・是正率（Band 3以上）</span>
                  <span className="font-mono text-blue-400 font-bold">
                    34.3% → 79.0% (+44.7 pt)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500 w-[79%]" />
                  <div className="h-full bg-slate-800 flex-1" />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-[11px] text-emerald-300 leading-relaxed">
              ✓ 成果物を鵜呑みにせず、隠れた前提や例外系を対話で修正できるエンジニアが全体の約8割に達しました。
            </div>
          </div>

          {/* Card B: Manager Coaching Prescriptions */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                マネージャー向け推奨育成アクション
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              受講データに基づき、マネージャー（EM）が現場ですぐに打てる育成フォローを提案します。
            </p>

            <div className="space-y-3">
              {/* Action 1: Reminder */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>30日以上未受講（4名）</span>
                  </span>
                  <button
                    onClick={handleSendReminder}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    リマインド送信
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  小林大樹さん、高橋さん他2名が未受講。月次目標達成に向けてリマインドを推奨。
                </p>
              </div>

              {/* Action 2: Task Recommendation */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-400" />
                    <span>非同期例外の重点演習</span>
                  </span>
                  <button
                    onClick={handleSendRecommendation}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    一括推奨配信
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  フロントエンドチーム向けに、演習課題「T-06b（キャッシュ不整合の是正）」の受講を推奨。
                </p>
              </div>

              {/* Action 3: 1on1 Advice */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>1on1指導ヒント</span>
                </span>
                <p className="text-[11px] text-slate-400 leading-snug">
                  佐藤拓也さんはWhat-if前提変化への適応がBand 4に到達。チーム内のPR設計レビュアー推薦が有効です。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Department Sub-summary (Left) & Export/Audit Proof (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Department Operations Sub-summary */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                部門別 運用・定着サマリー（サブ集計）
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">全5部門集計</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            各部門の受講完了率とアクティブ率を可視化し、研修の形骸化や受講格差を防止します。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase">
                  <th className="py-2.5 px-2">対象部門</th>
                  <th className="py-2.5 px-2 text-center">人数</th>
                  <th className="py-2.5 px-2 text-center">完了率</th>
                  <th className="py-2.5 px-2 text-center">アクティブ率</th>
                  <th className="py-2.5 px-2 text-center">平均時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {TEAMS_SUMMARY.map((team) => (
                  <tr key={team.name} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-2 font-medium text-slate-200">
                      {team.name}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                      {team.memberCount}名
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">
                      <span className={team.completionRate >= 90 ? "text-emerald-400 font-bold" : "text-slate-300"}>
                        {team.completionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">
                      <span className={team.activeRate >= 85 ? "text-blue-400" : "text-amber-400"}>
                        {team.activeRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                      {team.avgHours.toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Subsidy & Internal Compliance Export */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                受講履歴・学習時間データ（助成金・社内報告用CSV）
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              厚生労働省「人材開発支援助成金（事業展開等リスキリング支援コース）」の申請要件である「10時間以上の訓練」「出席率80%以上」を証明する改ざん不能な受講ログデータです。
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">対象プログラム</span>
              <span className="text-white font-semibold">生成AI協働・動的検証演習（12時間構成）</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">受講者数・ログ件数</span>
              <span className="font-mono text-white">142名 / 累計 1,704セッション</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">助成金要件クリア率（出席率80%以上）</span>
              <span className="font-mono text-emerald-400 font-bold">86.4%（123名達成）</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleExportCsv}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>助成金提出用受講ログCSV</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>経営報告用サマリーPDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom CTA to Interactive Session */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/80 border border-blue-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
            <Sparkles className="w-4 h-4" />
            <span>コア技術の稼働（Feasibility）を確認する</span>
          </div>
          <h3 className="text-lg font-bold text-white">
            中核評価エンジンによる実務ロールプレイング演習を体験
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            AI同僚との動的対話、ソクラテス型深掘り・What-if注入、CFF事前暫定判断、およびAutoSCOREによる2段階根拠抽出＆動的コンピテンシー解析を実際に動かせます。
          </p>
        </div>

        <button
          onClick={onStartSession}
          className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
        >
          <span>演習セッションを開始</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
