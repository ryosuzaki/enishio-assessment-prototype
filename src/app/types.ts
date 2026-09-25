// Application Types for Assessment Prototype

/**
 * どのバンクを読み込んだかの表示用。**サンプルを運用バンクに見せない／退役形式を
 * 現行形式に見せない**ため、画面へそのまま出す（実装指示書 §W6）。
 */
export type AnchorBankSourceView =
  | "operational_v2"
  | "demo_sample_v2"
  | "operational_v1_retired"
  | "demo_sample_v1_retired";

export function isRetiredBankSource(s: AnchorBankSourceView | null): boolean {
  return s === "operational_v1_retired" || s === "demo_sample_v1_retired";
}

export interface AnchorOptionView {
  key: string;
  text: string;
}

/**
 * 4段構成の疑似対話形式アンカー [D-83]。
 *
 * 段階1は「採用可否」だけを問い、**選択肢に答え（隠れた前提の中身）を含めない**。
 * 選択肢を提示した時点で「言われずに気づく」という測定対象が消えるため、そこを
 * 先に確定させてから細部へ降りる。段階3で前提変化（新情報）を注入し、判断が
 * どちらへ動くかをリッカートで取る——ここは正答鍵ではなく専門家パネルの応答分布で
 * 採点するため、単一の正解が存在しない。
 *
 * サーバは `correct_key` / `item_kind` / パネル分布を落として返す（採点鍵のため）。
 */
export interface AnchorItem {
  anchor_id: string;
  format_version: "v2-sct";
  family: string;
  title: string;
  intro: string;
  proposal: string;
  confidence_scale?: string;
  stage1: { question: string; options: AnchorOptionView[] };
  /** 類型C（不備なし）では段階2を出題しないため null */
  stage2: { question: string; options: AnchorOptionView[] } | null;
  /** 段階2の提示順（サーバでシャッフルされる）。応答と一緒に記録する */
  stage2_order: string | null;
  stage3: {
    new_information: string;
    question: string;
    scale: { value: number; label: string }[];
    /** "mock" の間はパネルがダミーであり、採点値を出してはならない [D-82] */
    panel_status: "mock" | "provisional" | "final";
    panel_n: number;
  };
  /**
   * 段階3'（項目によっては null）: 新情報を含まない反論を受けての再回答。
   * 段階3との差分が迎合（過剰依存）の指標になる。パネル不要 [D-83]。
   */
  stage3b: { pushback: string; question: string } | null;
}

export interface ChatMessage {
  turnSeq: number;
  // "mediator" はソクラテス型深掘り・What-if注入（MVP 2.1 ステップ7・8）の問い。
  // AI同僚（assistant）とは別役割であり、画面上も区別して表示する。
  role: "user" | "assistant" | "system" | "mediator";
  content: string;
}

export const DISAGREEMENT_OPTIONS = [
  { value: "too_high", label: "評点が高すぎる" },
  { value: "too_low", label: "評点が低すぎる" },
  { value: "axis_mismatch", label: "軸の割り当てが違う" },
  { value: "evidence_wrong", label: "根拠として示された箇所が違う" },
] as const;

export interface EvidenceComponent {
  turn_index: number;
  quoted_span: string;
  component_type: string;
  grounding?: "none" | "asserted" | "tied_to_requirement";
  injected_flaw_id: string | null;
  rationale_summary: string;
}

export interface ProbeConsistency {
  score: number | null;
  rationale: string;
}

export interface EvaluationResult {
  ratingId: string;
  isPendingHumanReview: boolean;
  ratingCategory: number | null;
  levelLabel: string | null;
  scoringConfidence: number;
  // pending_human 判定に使われた閾値。既定は0.70固定ではなく、環境変数
  // HITL_DEMO_CONFIDENCE_THRESHOLD が設定されていればその値になる（デモ用）。
  confidenceThreshold: number;
  isDemoThresholdOverride: boolean;
  evidenceSummary: string;
  diagnosticFeedback: string;
  evidenceComponents: EvidenceComponent[];
  probeConsistency: ProbeConsistency | null;
  scorerModelVersion: string;
}

// --- Mediation (MVP 2.1 ステップ7・8: ソクラテス型深掘り・What-if注入) ---
// src/lib/mediator/index.ts の EVIDENCE_TARGETS / PROBE_MOVES と対応する。
// あちらはサーバ専用モジュール（`.server.ts` ではないが LLM SDK を使うためクライアント
// から import しない）なので、画面側の型と表示ラベルはここに複製する。

export const EVIDENCE_TARGETS = [
  "premise_articulation",
  "tradeoff_reasoning",
  "requirement_grounding",
  "normal_span_discrimination",
  "robustness_under_changed_premise",
] as const;

export type EvidenceTarget = (typeof EVIDENCE_TARGETS)[number];

export const EVIDENCE_TARGET_LABELS: Record<EvidenceTarget, string> = {
  premise_articulation: "提案に置かれた暗黙の前提の言語化",
  tradeoff_reasoning: "前提から生じるトレードオフ・リスクの説明",
  requirement_grounding: "指摘を業務要件・制約のどこに紐づけているか",
  normal_span_discrimination: "疑わしく見える箇所を正当と判断できているか",
  robustness_under_changed_premise: "前提が変わったときに判断がどう変わるか",
};

export interface EvidenceTargetState {
  target: EvidenceTarget;
  status: "elicited" | "partial" | "not_elicited";
  basis: string;
}

export const PROBE_MOVES = [
  "deepen_rationale",
  "trace_grounding",
  "what_if",
  "self_report_gap",
  "scope_refocus",
  "test_scenario_probe",
  "none",
] as const;

export type ProbeMove = (typeof PROBE_MOVES)[number];

// src/lib/mediator/index.ts の MAX_PROBES_PER_SESSION と一致させる（サーバ専用モジュールの
// ため画面側では複製する）。MVP 2.1 ステップ7が「3〜4ターン」の深掘りを必須としている。
export const MAX_PROBES_PER_SESSION = 4;

export const PROBE_MOVE_LABELS: Record<ProbeMove, string> = {
  deepen_rationale: "深掘り：なぜそう判断したか",
  trace_grounding: "深掘り：その根拠は文脈のどこから来ているか",
  what_if: "What-if 注入：前提が変わったら指摘は変わるか",
  self_report_gap: "自己申告：見落とした観点はあるか",
  scope_refocus: "視座の引き上げ：非機能要件・運用基準の観点で懸念はあるか",
  test_scenario_probe: "異常系の想起：本番障害を防ぐためにどんなテストシナリオを想定すべきか",
  none: "問わない（十分に引き出せている）",
};

export type StepType =
  | "init"
  // アンカー4段 [D-83]: 採用可否 → 懸念領域 → 前提変化への判断更新 → 確信度
  | "anchor_stage1"
  | "anchor_stage2"
  | "anchor_stage3"
  | "anchor_stage3b"
  | "anchor_conf"
  | "anchor_complete"
  | "dialogue_session"
  | "preliminary_judgement"
  | "evaluation_report";

export type AppTab = "session" | "anchor" | "org_dashboard" | "learner_profile" | "benchmark_gallery";

export interface PremiseShiftState {
  isInjected: boolean;
  injectedAtTurn?: number;
  title?: string;
  announcement?: string;
  newRequirement?: string;
}

