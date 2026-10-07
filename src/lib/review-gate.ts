import type { ChatMessage } from "@/app/types";

/**
 * 検証の提出ボタンの名前と、押せる条件。
 *
 * 受講者は検証が終わったと思ったら「検証を提出する」を押す。提出された時点で進行役が前提変化を
 * 出し、受講者がそれに応答してから「最終判断へ進む」で意思決定へ進む `[D-135]`。
 * 押した結果を名前が正直に表すよう、前提変化の前後でボタンの名前を替える。
 *
 * 押せる条件:
 * - 提出（前提変化の前）: 受講者が進行役の深掘りに最低回数答えていること。深掘りは必須
 *   （測定設計書 2.1 ステップ5）で、答えずに先へ進めると、必須の段階を飛ばせてしまう。
 *   ただし深掘りを出せない状況（LLM が使えない等）では詰まらないよう、条件を外す。
 * - 最終判断へ（前提変化の後）: 受講者が前提変化に1回以上応答していること。応答が無いと、
 *   前提変化への適応という測りたいものが何も残らない。
 */

export type ReviewStage = "verify" | "after_shift";

export interface ReviewGate {
  stage: ReviewStage;
  /** ボタンの名前 */
  label: string;
  /** 押せるか */
  canAct: boolean;
  /** 押せない理由。押せるときは null */
  hint: string | null;
  /** 深掘りへの回答数（検証の段階のみ意味を持つ） */
  answeredProbes: number;
}

/** 進行役の深掘りのうち、受講者が答えた（その後に受講者の発言が続いた）ものの数 */
export function countAnsweredProbes(history: readonly Pick<ChatMessage, "role" | "kind">[]): number {
  let answered = 0;
  let open = false;
  for (const m of history) {
    if (m.role === "mediator" && m.kind === "probe") {
      open = true;
    } else if (m.role === "user" && open) {
      answered += 1;
      open = false;
    }
  }
  return answered;
}

/** 前提変化の通知より後の、受講者の発言数 */
export function countUserMessagesAfterShift(history: readonly Pick<ChatMessage, "role" | "kind">[]): number {
  const shiftIndex = history.findIndex((m) => m.role === "mediator" && m.kind === "premise_shift");
  if (shiftIndex === -1) return 0;
  return history.slice(shiftIndex + 1).filter((m) => m.role === "user").length;
}

export function evaluateReviewGate(input: {
  history: readonly Pick<ChatMessage, "role" | "kind">[];
  premiseShiftInjected: boolean;
  /** 深掘りを出せなかったため、深掘りの必須を外した */
  probeGateReleased: boolean;
  /** 応答や深掘りの生成を待っている */
  busy: boolean;
  minProbes: number;
}): ReviewGate {
  const answeredProbes = countAnsweredProbes(input.history);

  if (input.premiseShiftInjected) {
    const responded = countUserMessagesAfterShift(input.history) >= 1;
    const hint = input.busy
      ? "応答を待っています"
      : responded
        ? null
        : "追加要件への対応を、AIエージェントへ入力してください";
    return { stage: "after_shift", label: "最終判断へ進む", canAct: hint === null, hint, answeredProbes };
  }

  const started = input.history.some((m) => m.role === "user");
  let hint: string | null = null;
  if (input.busy) {
    hint = "応答を待っています";
  } else if (!started) {
    hint = "AIエージェントに指示・指摘を入力して、検証を始めてください";
  } else if (!input.probeGateReleased && answeredProbes < input.minProbes) {
    hint = `進行役の深掘りに答えてください（${answeredProbes}/${input.minProbes}）`;
  }
  return { stage: "verify", label: "検証を提出する", canAct: hint === null, hint, answeredProbes };
}
