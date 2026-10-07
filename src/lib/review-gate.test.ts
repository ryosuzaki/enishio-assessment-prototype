import { describe, expect, it } from "vitest";
import { countAnsweredProbes, countUserMessagesAfterShift, evaluateReviewGate } from "./review-gate";

type Msg = { role: "user" | "assistant" | "mediator"; kind?: "probe" | "premise_shift" };
const user: Msg = { role: "user" };
const ai: Msg = { role: "assistant" };
const probe: Msg = { role: "mediator", kind: "probe" };
const shift: Msg = { role: "mediator", kind: "premise_shift" };

const base = { premiseShiftInjected: false, probeGateReleased: false, busy: false, minProbes: 3 };

describe("countAnsweredProbes", () => {
  it("深掘りの後に受講者の発言が続いたものだけを数える", () => {
    expect(countAnsweredProbes([user, ai, probe, user, ai, probe])).toBe(1);
    expect(countAnsweredProbes([user, ai, probe, user, ai, probe, user, ai])).toBe(2);
  });

  it("前提変化の通知は深掘りに数えない", () => {
    expect(countAnsweredProbes([user, ai, shift, user])).toBe(0);
  });

  it("1つの深掘りに複数回答えても1回と数える", () => {
    expect(countAnsweredProbes([user, ai, probe, user, ai, user, ai])).toBe(1);
  });
});

describe("countUserMessagesAfterShift", () => {
  it("通知の前の発言は数えず、後の発言だけを数える", () => {
    expect(countUserMessagesAfterShift([user, ai, shift, user, ai, user])).toBe(2);
    expect(countUserMessagesAfterShift([user, ai, shift])).toBe(0);
  });

  it("前提変化が無ければ 0", () => {
    expect(countUserMessagesAfterShift([user, ai, probe, user])).toBe(0);
  });
});

describe("evaluateReviewGate（検証の段階）", () => {
  it("何も発言していないうちは押せず、始め方を示す", () => {
    const gate = evaluateReviewGate({ ...base, history: [] });
    expect(gate).toMatchObject({ stage: "verify", label: "検証を提出する", canAct: false });
    expect(gate.hint).toContain("検証を始めてください");
  });

  it("深掘りへの回答が最低回数に届くまで押せず、進み具合を示す", () => {
    const history = [user, ai, probe, user, ai, probe];
    const gate = evaluateReviewGate({ ...base, history });
    expect(gate.canAct).toBe(false);
    expect(gate.hint).toBe("進行役の深掘りに答えてください（1/3）");
  });

  it("最低回数に答えたら押せる", () => {
    const history = [user, ai, probe, user, ai, probe, user, ai, probe, user, ai];
    const gate = evaluateReviewGate({ ...base, history });
    expect(gate).toMatchObject({ canAct: true, hint: null, answeredProbes: 3 });
  });

  it("深掘りを出せなかった場合は、必須を外して押せる", () => {
    const gate = evaluateReviewGate({ ...base, history: [user, ai], probeGateReleased: true });
    expect(gate.canAct).toBe(true);
  });

  it("応答や深掘りを待っている間は押せない", () => {
    const history = [user, ai, probe, user, ai, probe, user, ai, probe, user, ai];
    const gate = evaluateReviewGate({ ...base, history, busy: true });
    expect(gate).toMatchObject({ canAct: false, hint: "応答を待っています" });
  });
});

describe("evaluateReviewGate（前提変化の後）", () => {
  const after = { ...base, premiseShiftInjected: true };

  it("名前が「最終判断へ進む」に替わり、前提変化に応答するまで押せない", () => {
    const gate = evaluateReviewGate({ ...after, history: [user, ai, probe, user, ai, shift] });
    expect(gate).toMatchObject({ stage: "after_shift", label: "最終判断へ進む", canAct: false });
    expect(gate.hint).toContain("追加要件への対応");
  });

  it("前提変化に1回応答したら押せる", () => {
    const gate = evaluateReviewGate({ ...after, history: [user, ai, shift, user, ai] });
    expect(gate).toMatchObject({ canAct: true, hint: null });
  });

  it("深掘りの回数は問わない（その段階は提出の前に終わっている）", () => {
    const gate = evaluateReviewGate({ ...after, history: [user, ai, shift, user, ai] });
    expect(gate.canAct).toBe(true);
  });
});
