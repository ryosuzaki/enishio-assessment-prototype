/**
 * 固定設問（v2-sct）の決定論的採点。仕様: specs/001-session-orchestration/spec.md [US2b]
 *
 * LLM を一切使わない。第2層の外部基準は「LLM の外から判定器を見張る」ためにあるので、
 * ここに LLM が入ると較正対象で較正することになる。
 *
 * 結果は受講者へ返さない。正誤やパネル分布を返すと、それが学習材料になって基準点そのものが動く。
 */
import type { AnchorRecordV2 } from "./anchor-bank";

export interface AnchorAnswer {
  stage1: string;
  /** 段階3の選択（-2..2） */
  stage3: number;
  /** 段階3'の選択（-2..2）。段階3'を出題しなかった項目では undefined */
  stage3b?: number;
}

export type Stage3Score =
  | { status: "scored"; credit: number }
  | { status: "not_scored"; reason: "panel_mock" };

export interface AnchorScore {
  /** 段階1：正答キーとの一致（1 / 0） */
  stage1: 0 | 1;
  /** 段階3：専門家パネルの回答分布による部分点（0〜1） */
  stage3: Stage3Score;
  /** 段階3'：stage3b − stage3。0 なら圧力に対して立場を保てた。段階3'が無い項目では null */
  stage3bDelta: number | null;
}

/**
 * SCT の aggregate scoring。受講者の選んだ選択肢を選んだパネリスト数を、
 * 最も多く選ばれた選択肢のパネリスト数で割る（最頻の選択肢が満点、誰も選ばない選択肢は0）。
 */
export function aggregateCredit(distribution: Record<string, number>, selection: number): number {
  const modal = Math.max(...Object.values(distribution));
  if (!(modal > 0)) throw new Error("panel distribution has no responses");
  return (distribution[String(selection)] ?? 0) / modal;
}

export function scoreAnchorResponse(item: AnchorRecordV2, answer: AnchorAnswer): AnchorScore {
  const stage1: 0 | 1 = answer.stage1 === item.stage1.correct_key ? 1 : 0;

  // ダミー分布で点を出さない [D-82] 決定3
  const { panel } = item.stage3;
  const stage3: Stage3Score =
    panel.status === "mock"
      ? { status: "not_scored", reason: "panel_mock" }
      : { status: "scored", credit: aggregateCredit(panel.distribution, answer.stage3) };

  // 段階3'は同一受講者内の差分だけで、パネルを要さない [D-83]
  const stage3bDelta =
    item.stage3b && answer.stage3b !== undefined ? answer.stage3b - answer.stage3 : null;

  return { stage1, stage3, stage3bDelta };
}
