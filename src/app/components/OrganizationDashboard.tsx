"use client";

import React, { useState } from "react";
import { Badge, Button, Card, cn, thresholdTone, toneChip, type Tone } from "./ui";

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

/**
 * KPI の1枚。
 *
 * 上端の色帯や指標ごとのアイコンは置かない——4 枚が別々の色を持つと、どれが重いのかが
 * 色の派手さで決まってしまう。主役は数値そのものなので、大きさと桁揃えで見せる（[D-101]）。
 */
function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaTone = "neutral",
  note,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** 前期との差や達成率。**符号ではなく指標ごとの良い向きで色を決める** */
  delta?: string;
  deltaTone?: Tone;
  note: string;
}) {
  return (
    <div className="space-y-2 rounded-card border border-line bg-surface p-5">
      <p className="text-caption text-ink-3">{label}</p>
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-display tracking-tight text-ink" data-numeric>
          {value}
        </span>
        {unit && <span className="text-caption text-ink-2">{unit}</span>}
        {delta && (
          <span className={cn("ml-auto text-section font-semibold", toneChip(deltaTone))} data-numeric>
            {delta}
          </span>
        )}
      </p>
      <p className="text-caption text-ink-2">{note}</p>
    </div>
  );
}

/** Before / After の対比バー。改善後だけがアクセントを持ち、改善前は罫線色で沈める。 */
function BeforeAfterBar({
  label,
  summary,
  before,
  after,
}: {
  label: string;
  summary: string;
  before?: number;
  after: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-caption">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-semibold text-ink" data-numeric>
          {summary}
        </span>
      </div>
      {before !== undefined && (
        <div className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-caption text-ink-3">初回</span>
          <div className="h-2 flex-1 overflow-hidden rounded-chip bg-surface">
            <div className="h-full rounded-chip bg-line-strong" style={{ width: `${before}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-caption text-ink-3">直近</span>
        <div className="h-2 flex-1 overflow-hidden rounded-chip bg-surface">
          <div className="h-full rounded-chip bg-positive" style={{ width: `${after}%` }} />
        </div>
      </div>
    </div>
  );
}

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

  /**
   * 受講状況。**これは状態なので意味色を割り当てる**——到達 Band のような連続量の
   * 序列付けには使わない（数値そのものが序列を示す）。
   */
  const getStatusBadge = (status: LearnerItem["status"]) => {
    if (status === "completed") return <Badge tone="positive">修了済み</Badge>;
    if (status === "active") return <Badge tone="neutral">受講中</Badge>;
    return <Badge tone="caution">要フォロー</Badge>;
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
    <div className="space-y-section">
      {/* Header & Meta Bar */}
      <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-cell">
            <h1 className="text-display tracking-tight text-ink">組織・受講管理ダッシュボード</h1>
            <Badge tone="neutral">Viability</Badge>
          </div>
          <p className="max-w-3xl text-body text-ink-2">
            企業向けの育成・管理ポータルです。受講者個人の学習進捗と動的コンピテンシー（4領域）の成長推移を一元管理し、
            演習によるバイアス克服成果の実証と、現場マネージャーの育成フォロー（1on1・推奨課題配信）を支援します。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handleExportCsv}>
            助成金用受講ログCSV
          </Button>
          {onViewBenchmarkGallery && (
            <Button variant="secondary" onClick={() => onViewBenchmarkGallery()}>
              エキスパート事後講評
            </Button>
          )}
          <Button variant="primary" onClick={onStartSession}>
            実務演習を直接体験
          </Button>
        </div>
      </header>

      {/* Global Notifications / Toasts */}
      {csvExportSuccess && (
        <p
          role="status"
          className="rounded-card border border-accent/25 bg-accent-wash p-3.5 text-caption text-ink"
        >
          【助成金申請用ログ出力完了】厚生労働省
          人材開発支援助成金（リスキリング支援コース）提出用受講時間・出席ログ（142名分・12時間構成CSV）をダウンロードしました。
        </p>
      )}
      {remindSuccess && (
        <p
          role="status"
          className="rounded-card border border-accent/25 bg-accent-wash p-3.5 text-caption text-ink"
        >
          受講停滞メンバー（30日以上未受講）へ、Slackおよびメールで演習リマインドを配信しました。
        </p>
      )}
      {recommendSuccess && (
        <p
          role="status"
          className="rounded-card border border-accent/25 bg-accent-wash p-3.5 text-caption text-ink"
        >
          非同期エラー検証の強化対象メンバーへ、推奨課題「T-06b（キャッシュ不整合の検知）」を一括配信しました。
        </p>
      )}

      {/*
        この画面に並ぶ受講者・組織の数値はすべてダミー値である。稼働実績ではない。
        本プロトタイプの目的は B2B SaaS としての画面設計（Viability）を示すことであり、
        効果量の測定は採択後の PoC で行う。実際に動く評価エンジンは「実務演習セッション」側にある。
      */}
      <p className="rounded-card border border-caution/30 bg-caution-wash p-3.5 text-caption text-ink-2">
        本画面はモックUIです。受講者名・受講状況・各指標はすべて画面設計を示すためのダミー値であり、稼働実績ではありません。
        実際に動作する評価エンジンは「実務演習セッション」タブでご確認いただけます。
      </p>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="受検完了エンジニア"
          value="142"
          unit="/ 161 名"
          delta="88.2%"
          deltaTone={thresholdTone(88.2, { good: 85, poor: 70 })}
          note="受講完了率が前期比 +12% 向上。月次演習の定着が進んでいます。"
        />
        <KpiCard
          label="組織平均 到達Band"
          value="Band 3.4"
          unit="/ 5.0"
          delta="+1.1 pt"
          deltaTone={thresholdTone(1.1, { good: 1.0, poor: 0.3 })}
          note="受講開始時の平均 Band 2.3 から「Band 3: 前提・トレードオフ検証」へ向上。"
        />
        <KpiCard
          label="盲従バイアス克服率"
          value="74.2%"
          unit="克服"
          delta="-28.4 pt"
          /* 無検証承認率が下がったという良い変化。**符号は負だが方向は正しい** */
          deltaTone={thresholdTone(-28.4, { good: -10, poor: 0, higherIsBetter: false })}
          note="初回演習時の無検証承認率 38.2% が直近 9.8% まで劇的に解消。"
        />
        <KpiCard
          label="累計受講・演習時間"
          value="1,704"
          unit="時間"
          delta="平均 10.6h / 名"
          /* 助成金の訓練要件は10時間以上。跨いでいるかどうかがこの数字の意味 */
          deltaTone={thresholdTone(10.6, { good: 10, poor: 8 })}
          note="人材開発支援助成金の10〜12時間訓練要件を 86.4% の受講者が達成。"
        />
      </div>

      {/* Main Section: Learner List Table (2/3 Width) & Growth/Action Panels (1/3 Width) */}
      {/* 左右の高さ差が開くと受講者一覧の下に大きな空白が残るため、比率を 3:2 にして
          右カラムの行数を減らし、`items-start` で無理に引き伸ばさない */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        {/* Main Table: Learner Roster & Skill Profile */}
        <div className="lg:col-span-3">
          <Card
            title="受講者一覧・スキル到達度カルテ"
            description="各エンジニアの受講進捗、動的コンピテンシー4領域Band、成長度を確認できます。行をクリックするとカルテ要約を表示します。"
            meta={
              <span data-numeric>
                表示: <strong className="font-semibold text-ink">{filteredLearners.length}名</strong>
              </span>
            }
          >
            <div className="space-y-block">
              {/* Filter Bar */}
              <div className="grid grid-cols-1 gap-3 rounded-card border border-line bg-surface-sunken p-3 sm:grid-cols-3">
                <input
                  type="search"
                  name="learner-search"
                  autoComplete="off"
                  spellCheck={false}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="氏名・所属・役職で検索…"
                  aria-label="受講者の検索"
                  className={cn(
                    "w-full rounded-chip border border-line-strong bg-surface px-3 py-1.5",
                    "text-caption text-ink focus:border-accent focus:outline-none",
                  )}
                />
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  aria-label="部署で絞り込む"
                  className={cn(
                    "w-full rounded-chip border border-line-strong bg-surface px-2.5 py-1.5",
                    "text-caption text-ink focus:border-accent focus:outline-none",
                  )}
                >
                  <option value="all">すべての部署</option>
                  <option value="決済基盤チーム">決済基盤チーム</option>
                  <option value="コアAPIプラットフォーム">コアAPIプラットフォーム</option>
                  <option value="SRE / インフラチーム">SRE / インフラチーム</option>
                  <option value="データ分析基盤チーム">データ分析基盤チーム</option>
                  <option value="モバイル・フロントエンドチーム">モバイル・フロントエンドチーム</option>
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="受講状況で絞り込む"
                  className={cn(
                    "w-full rounded-chip border border-line-strong bg-surface px-2.5 py-1.5",
                    "text-caption text-ink focus:border-accent focus:outline-none",
                  )}
                >
                  <option value="all">すべての受講状況</option>
                  <option value="completed">修了済み（12回）</option>
                  <option value="active">受講中（順調）</option>
                  <option value="stalled">要フォロー（停滞）</option>
                </select>
              </div>

              {/* Table */}
              <p className="text-label text-ink-3">
                ① 評価的判断力 ／ ② 高次認知・動的思考 ／ ③ 対話的共創力 ／ ④ メタ認知・適応力
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body">
                  <thead>
                    <tr className="border-b border-line text-caption text-ink-3">
                      <th className="px-3 py-2.5 font-medium">氏名・所属</th>
                      <th className="px-2 py-2.5 text-center font-medium">進捗</th>
                      <th className="px-2 py-2.5 text-center font-medium">現在Band</th>
                      <th className="px-2 py-2.5 text-center font-medium">①</th>
                      <th className="px-2 py-2.5 text-center font-medium">②</th>
                      <th className="px-2 py-2.5 text-center font-medium">③</th>
                      <th className="px-2 py-2.5 text-center font-medium">④</th>
                      <th className="px-2 py-2.5 text-center font-medium">成長</th>
                      <th className="px-3 py-2.5 text-center font-medium">状況</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredLearners.map((learner) => (
                      <tr
                        key={learner.id}
                        onClick={() => setActiveLearner(learner)}
                        className={cn(
                          "cursor-pointer border-l-2 transition-colors",
                          learner.status === "stalled" ? "border-l-caution" : "border-l-transparent",
                          activeLearner.id === learner.id ? "bg-accent-wash" : "hover:bg-surface-sunken",
                        )}
                      >
                        <td className="max-w-[13rem] px-3 py-2.5">
                          <span className="block whitespace-nowrap font-semibold text-ink">{learner.name}</span>
                          {/* 所属は参照情報。長くても行の高さを崩さないよう1行で切る（全文は title で読める） */}
                          <span
                            className="mt-0.5 block truncate text-label text-ink-3"
                            title={`${learner.team}（${learner.role}）`}
                          >
                            {learner.team}（{learner.role}）
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex flex-col items-center">
                            <span className="text-data text-ink-2" data-numeric>
                              {learner.progress.completed} / {learner.progress.total}
                            </span>
                            <div className="mt-1 h-1.5 w-14 overflow-hidden rounded-chip bg-surface-sunken">
                              <div
                                className="h-full rounded-chip bg-accent"
                                style={{
                                  width: `${(learner.progress.completed / learner.progress.total) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="text-data font-semibold text-ink" data-numeric>
                            {learner.overallBand.toFixed(1)}
                          </span>
                        </td>
                        {/* Band 3 に届いていない領域を拾えるようにする。手当ての対象はここから決まる */}
                        {(
                          [
                            learner.scores.epistemic,
                            learner.scores.metacognition,
                            learner.scores.dialogue,
                            learner.scores.adaptation,
                          ] as const
                        ).map((score, i) => (
                          <td key={i} className="px-2 py-2.5 text-center text-data" data-numeric>
                            <span
                              className={cn(
                                "font-semibold",
                                toneChip(thresholdTone(score, { good: 4.0, poor: 3.0 })),
                              )}
                            >
                              {score.toFixed(1)}
                            </span>
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-center text-data" data-numeric>
                          <span
                            className={cn(
                              "font-semibold",
                              toneChip(
                                thresholdTone(learner.overallBand - learner.initialBand, {
                                  good: 1.0,
                                  poor: 0.5,
                                }),
                              ),
                            )}
                          >
                            +{(learner.overallBand - learner.initialBand).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{getStatusBadge(learner.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Selected Learner Quick Summary Card */}
              <div className="flex flex-col justify-between gap-4 rounded-card border border-line bg-surface-sunken p-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-section text-ink">
                      選択中: {activeLearner.name} さん
                    </span>
                    <span className="text-caption text-ink-3">
                      （{activeLearner.team} / {activeLearner.role}）
                    </span>
                    <Badge tone="neutral">{activeLearner.biasLabel}</Badge>
                  </p>
                  <p className="max-w-2xl text-caption text-ink-2">{activeLearner.biasNote}</p>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => {
                    if (onViewLearnerProfile) {
                      onViewLearnerProfile(activeLearner.id);
                    } else {
                      onStartSession();
                    }
                  }}
                  className="shrink-0"
                >
                  受講者カルテ詳細を開く
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side: Efficacy Before/After & Manager Action Recommendations */}
        <div className="space-y-section lg:col-span-2">
          {/* Card A: Bias Overcome & Efficacy (Before vs After) */}
          <Card
            title="バイアス克服・教育成果（Before / After）"
            meta={<Badge tone="caution">ダミー値</Badge>}
          >
            <div className="space-y-cell">
              <p className="text-caption text-ink-2">
                受講者全員の初期演習（初回〜2回目）と直近演習の比較を想定した画面です。AI出力を批判的に検証する行動の定着を、この形で提示します。
              </p>
              <p className="rounded-chip border border-caution/25 bg-caution-wash px-3 py-2 text-caption text-ink-2">
                本カードの数値は画面設計を示すためのダミー値であり、実測値ではありません。効果量の測定は採択後のPoCで行います。
              </p>

              <div className="space-y-cell pt-1">
                <BeforeAfterBar
                  label="AI盲従（無検証即時承認率）"
                  summary="38.2% → 9.8% (-28.4 pt)"
                  before={38.2}
                  after={9.8}
                />
                <BeforeAfterBar
                  label="正常コード過剰指摘率（手戻り要因）"
                  summary="27.5% → 11.2% (-16.3 pt)"
                  before={27.5}
                  after={11.2}
                />
                <BeforeAfterBar
                  label="適切差し戻し・是正率（Band 3以上）"
                  summary="34.3% → 79.0% (+44.7 pt)"
                  before={34.3}
                  after={79.0}
                />
              </div>

              <p className="rounded-chip border border-line bg-surface-sunken p-3 text-caption text-ink-2">
                成果物を鵜呑みにせず、隠れた前提や例外系を対話で修正できるエンジニアが全体の約8割に達しました。
              </p>
            </div>
          </Card>

          {/* Card B: Manager Coaching Prescriptions */}
          <Card
            title="マネージャー向け推奨育成アクション"
            description="受講データに基づき、マネージャー（EM）が現場ですぐに打てる育成フォローを提案します。"
          >
            <div className="space-y-cell">
              <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-section text-ink">30日以上未受講（4名）</span>
                  <Button variant="secondary" onClick={handleSendReminder} className="px-2 py-1 text-caption">
                    リマインド送信
                  </Button>
                </div>
                <p className="text-caption text-ink-2">
                  小林大樹さん、高橋さん他2名が未受講。月次目標達成に向けてリマインドを推奨。
                </p>
              </div>

              <div className="space-y-2 rounded-card border border-line bg-surface-sunken p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-section text-ink">非同期例外の重点演習</span>
                  <Button
                    variant="secondary"
                    onClick={handleSendRecommendation}
                    className="px-2 py-1 text-caption"
                  >
                    一括推奨配信
                  </Button>
                </div>
                <p className="text-caption text-ink-2">
                  フロントエンドチーム向けに、演習課題「T-06b（キャッシュ不整合の是正）」の受講を推奨。
                </p>
              </div>

              <div className="space-y-1 rounded-card border border-line bg-surface-sunken p-3">
                <p className="text-section text-ink">1on1指導ヒント</p>
                <p className="text-caption text-ink-2">
                  佐藤拓也さんはWhat-if前提変化への適応がBand 4に到達。チーム内のPR設計レビュアー推薦が有効です。
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Department Sub-summary (Left) & Export/Audit Proof (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Department Operations Sub-summary */}
        <Card
          title="部門別 運用・定着サマリー（サブ集計）"
          description="各部門の受講完了率とアクティブ率を可視化し、研修の形骸化や受講格差を防止します。"
          meta="全5部門集計"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-caption">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th className="px-2 py-2.5 font-medium">対象部門</th>
                  <th className="px-2 py-2.5 text-center font-medium">人数</th>
                  <th className="px-2 py-2.5 text-center font-medium">完了率</th>
                  <th className="px-2 py-2.5 text-center font-medium">アクティブ率</th>
                  <th className="px-2 py-2.5 text-center font-medium">平均時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {TEAMS_SUMMARY.map((team) => (
                  <tr key={team.name}>
                    <td className="px-2 py-2.5 font-medium text-ink">{team.name}</td>
                    <td className="px-2 py-2.5 text-center text-ink-2" data-numeric>
                      {team.memberCount}名
                    </td>
                    <td className="px-2 py-2.5 text-center" data-numeric>
                      <span
                        className={cn(
                          "font-semibold",
                          toneChip(thresholdTone(team.completionRate, { good: 90, poor: 80 })),
                        )}
                      >
                        {team.completionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center" data-numeric>
                      <span
                        className={cn(
                          "font-semibold",
                          toneChip(thresholdTone(team.activeRate, { good: 90, poor: 75 })),
                        )}
                      >
                        {team.activeRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-ink-2" data-numeric>
                      {team.avgHours.toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right: Subsidy & Internal Compliance Export */}
        <Card
          title="受講履歴・学習時間データ（助成金・社内報告用CSV）"
          description="厚生労働省「人材開発支援助成金（事業展開等リスキリング支援コース）」の申請要件である「10時間以上の訓練」「出席率80%以上」を証明する改ざん不能な受講ログデータです。"
        >
          <div className="space-y-block">
            <dl className="space-y-2 rounded-card border border-line bg-surface-sunken p-4">
              <div className="flex justify-between gap-3 text-caption">
                <dt className="text-ink-2">対象プログラム</dt>
                <dd className="text-right font-semibold text-ink">
                  生成AI協働・動的検証演習（12時間構成）
                </dd>
              </div>
              <div className="flex justify-between gap-3 text-caption">
                <dt className="text-ink-2">受講者数・ログ件数</dt>
                <dd className="text-right text-ink" data-numeric>
                  142名 / 累計 1,704セッション
                </dd>
              </div>
              <div className="flex justify-between gap-3 text-caption">
                <dt className="text-ink-2">助成金要件クリア率（出席率80%以上）</dt>
                <dd className="text-right font-semibold text-ink" data-numeric>
                  86.4%（123名達成）
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" onClick={handleExportCsv} className="flex-1">
                助成金提出用受講ログCSV
              </Button>
              <Button variant="secondary" onClick={handleExportCsv} className="flex-1">
                経営報告用サマリーPDF
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom CTA to Interactive Session */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-card border border-line bg-surface-sunken p-6 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-cell">
            <h3 className="text-title text-ink">中核評価エンジンによる実務ロールプレイング演習を体験</h3>
            <Badge tone="neutral">Feasibility</Badge>
          </div>
          <p className="max-w-2xl text-caption text-ink-2">
            AI同僚との動的対話、ソクラテス型深掘り・What-if注入、CFF事前暫定判断、および構造化採点パイプラインによる2段階根拠抽出＆動的コンピテンシー解析を実際に動かせます。
          </p>
        </div>

        <Button variant="primary" onClick={onStartSession} className="shrink-0">
          演習セッションを開始
        </Button>
      </div>
    </div>
  );
}
