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
  role: "user" | "assistant" | "system";
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
  injected_flaw_id: string | null;
  rationale_summary: string;
}

export interface EvaluationResult {
  ratingId: string;
  isPendingHumanReview: boolean;
  ratingCategory: number | null;
  levelLabel: string | null;
  scoringConfidence: number;
  evidenceSummary: string;
  diagnosticFeedback: string;
  evidenceComponents: EvidenceComponent[];
  scorerModelVersion: string;
}

export type StepType =
  | "init"
  | "anchor_q1"
  | "anchor_q2"
  | "anchor_conf"
  | "anchor_complete"
  | "dialogue_session"
  | "preliminary_judgement"
  | "evaluation_report";
