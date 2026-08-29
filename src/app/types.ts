// Application Types for Assessment Prototype

export interface AnchorItem {
  anchor_id: string;
  family: string;
  title: string;
  intro: string;
  proposal: string;
  q1: {
    question: string;
    options: { key: string; text: string }[];
  };
  q2: {
    question: string;
    options: { key: string; text: string }[];
  };
}

export interface ChatMessage {
  turnSeq: number;
  // "mediator" はソクラテス型深掘り・What-if注入（MVP 2.1 ステップ7・8）の問い。
  // AI同僚（assistant）とは別役割であり、画面上も区別して表示する。
  role: "user" | "assistant" | "system" | "mediator";
  content: string;
}

export interface FocusItem {
  focusSeq: number;
  selectedText: string;
  note?: string;
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
// あちらはサーバ専用モジュール（`.server.ts` ではないが Anthropic SDK を使うためクライアント
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
  none: "問わない（十分に引き出せている）",
};

export type StepType =
  | "init"
  | "anchor_q1"
  | "anchor_q2"
  | "anchor_conf"
  | "anchor_complete"
  | "dialogue_session"
  | "preliminary_judgement"
  | "evaluation_report";
