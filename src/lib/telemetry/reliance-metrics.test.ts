import { beforeEach, describe, expect, it, vi } from "vitest";

// 適正依存3指標の算出そのものを検証する。DB は書き込み先でしかないのでモックし、
// upsert へ渡された値（＝算出結果）を読む。
vi.mock("../db", () => ({
  prisma: {
    relianceMetrics: { upsert: vi.fn().mockResolvedValue({ metrics_id: "metrics-1" }) },
  },
}));

import { prisma } from "../db";
import {
  RELIANCE_OPERATIONALIZATION,
  recordRelianceMetrics,
  type EvidenceComponentRecord,
} from "./index";

const upsert = prisma.relianceMetrics.upsert as unknown as ReturnType<typeof vi.fn>;

function component(
  componentType: string,
  injectedFlawId: string | null
): EvidenceComponentRecord {
  return {
    turnIndex: 1,
    quotedSpan: "（引用）",
    componentType,
    grounding: "tied_to_requirement",
    injectedFlawId,
    rationaleSummary: "（理由）",
  };
}

/** upsert に渡った算出結果を取り出す。create 側と update 側は同じ値でなければならない。 */
function recordedMetrics() {
  expect(upsert).toHaveBeenCalledOnce();
  const arg = upsert.mock.calls[0][0];
  // 新規と更新で別の値を書いていたら、2回目の実行で指標が変わってしまう
  expect(arg.create).toMatchObject(arg.update);
  return arg;
}

async function run(params: {
  flawIds: string[];
  validSpanIds: string[];
  components: EvidenceComponentRecord[];
}) {
  await recordRelianceMetrics({
    sessionId: "session-1",
    stepId: "step-1",
    ...params,
  });
  return recordedMetrics();
}

beforeEach(() => {
  upsert.mockClear();
});

describe("recordRelianceMetrics — 仕込み不備側（CSR / ABI）", () => {
  it("仕込み不備をすべて摘発すると CSR=1・ABI=0 になる", async () => {
    const arg = await run({
      flawIds: ["FLAW-01", "FLAW-02"],
      validSpanIds: [],
      components: [
        component("flaw_detection", "FLAW-01"),
        component("flaw_detection", "FLAW-02"),
      ],
    });

    expect(arg.update.correct_self_reliance).toBe(1);
    expect(arg.update.automation_bias_index).toBe(0);
    expect(arg.update.flaw_span_count).toBe(2);
  });

  it("1件も摘発できないと CSR=0・ABI=1 になる", async () => {
    const arg = await run({
      flawIds: ["FLAW-01", "FLAW-02"],
      validSpanIds: [],
      components: [],
    });

    expect(arg.update.correct_self_reliance).toBe(0);
    expect(arg.update.automation_bias_index).toBe(1);
  });

  it("半分だけ摘発すると 0.5 になる", async () => {
    const arg = await run({
      flawIds: ["FLAW-01", "FLAW-02"],
      validSpanIds: [],
      components: [component("flaw_detection", "FLAW-01")],
    });

    expect(arg.update.correct_self_reliance).toBe(0.5);
    expect(arg.update.automation_bias_index).toBe(0.5);
  });

  it("同じ不備を何度指摘しても二重に数えない", async () => {
    const arg = await run({
      flawIds: ["FLAW-01", "FLAW-02"],
      validSpanIds: [],
      components: [
        component("flaw_detection", "FLAW-01"),
        component("flaw_detection", "FLAW-01"),
        component("flaw_detection", "FLAW-01"),
      ],
    });

    expect(arg.update.correct_self_reliance).toBe(0.5);
  });

  it("このセッションに存在しない flaw_id の摘発は数えない", async () => {
    const arg = await run({
      flawIds: ["FLAW-01"],
      validSpanIds: [],
      components: [component("flaw_detection", "FLAW-FROM-ANOTHER-TASK")],
    });

    expect(arg.update.correct_self_reliance).toBe(0);
  });

  it("flaw_id に紐づかない一般的な検証行動は摘発として数えない", async () => {
    const arg = await run({
      flawIds: ["FLAW-01"],
      validSpanIds: [],
      components: [component("flaw_detection", null)],
    });

    expect(arg.update.correct_self_reliance).toBe(0);
  });

  it("前提の言語化（premise_identification）だけでは摘発として数えない", async () => {
    // 操作的定義では摘発は flaw_detection に限る。ここを緩めると指標の意味が変わる。
    const arg = await run({
      flawIds: ["FLAW-01"],
      validSpanIds: [],
      components: [component("premise_identification", "FLAW-01")],
    });

    expect(arg.update.correct_self_reliance).toBe(0);
  });
});

describe("recordRelianceMetrics — 正常箇所側（CAR）", () => {
  it("正常箇所を過剰指摘しなければ CAR=1 になる", async () => {
    const arg = await run({
      flawIds: [],
      validSpanIds: ["VALID-01", "VALID-02"],
      components: [],
    });

    expect(arg.update.correct_ai_reliance).toBe(1);
    expect(arg.update.valid_span_count).toBe(2);
  });

  it("正常箇所を過剰指摘すると CAR が下がる", async () => {
    const arg = await run({
      flawIds: [],
      validSpanIds: ["VALID-01", "VALID-02"],
      components: [component("false_positive_critique", "VALID-01")],
    });

    expect(arg.update.correct_ai_reliance).toBe(0.5);
  });

  it("すべての正常箇所を過剰指摘すると CAR=0 になる", async () => {
    const arg = await run({
      flawIds: [],
      validSpanIds: ["VALID-01"],
      components: [component("false_positive_critique", "VALID-01")],
    });

    expect(arg.update.correct_ai_reliance).toBe(0);
  });

  it("仕込み不備への false_positive_critique は CAR を下げない", async () => {
    // 正常箇所ではないものを過剰指摘扱いすると、CAR が測っている対象がずれる
    const arg = await run({
      flawIds: ["FLAW-01"],
      validSpanIds: ["VALID-01"],
      components: [component("false_positive_critique", "FLAW-01")],
    });

    expect(arg.update.correct_ai_reliance).toBe(1);
  });

  it("CSR と CAR は互いに干渉しない（不備の摘発と正常箇所の弁別を独立に数える）", async () => {
    const arg = await run({
      flawIds: ["FLAW-01", "FLAW-02"],
      validSpanIds: ["VALID-01", "VALID-02"],
      components: [
        component("flaw_detection", "FLAW-01"),
        component("false_positive_critique", "VALID-02"),
      ],
    });

    expect(arg.update.correct_self_reliance).toBe(0.5);
    expect(arg.update.automation_bias_index).toBe(0.5);
    expect(arg.update.correct_ai_reliance).toBe(0.5);
  });
});

describe("recordRelianceMetrics — 分母が0のとき", () => {
  it("仕込み不備が無いセッションでは CSR・ABI を null にする（0 で埋めない）", async () => {
    const arg = await run({
      flawIds: [],
      validSpanIds: ["VALID-01"],
      components: [],
    });

    // 0 を入れると「該当箇所が無かった」と「1件も正しく扱えなかった」が区別できなくなる
    expect(arg.update.correct_self_reliance).toBeNull();
    expect(arg.update.automation_bias_index).toBeNull();
    expect(arg.update.correct_ai_reliance).toBe(1);
  });

  it("正常箇所が無いセッションでは CAR を null にする", async () => {
    const arg = await run({
      flawIds: ["FLAW-01"],
      validSpanIds: [],
      components: [component("flaw_detection", "FLAW-01")],
    });

    expect(arg.update.correct_ai_reliance).toBeNull();
    expect(arg.update.correct_self_reliance).toBe(1);
  });

  it("どちらも無いセッションでは3指標すべてが null になる", async () => {
    const arg = await run({ flawIds: [], validSpanIds: [], components: [] });

    expect(arg.update.correct_self_reliance).toBeNull();
    expect(arg.update.automation_bias_index).toBeNull();
    expect(arg.update.correct_ai_reliance).toBeNull();
    expect(arg.update.flaw_span_count).toBe(0);
    expect(arg.update.valid_span_count).toBe(0);
  });
});

describe("recordRelianceMetrics — 記録のしかた", () => {
  it("セッションとステップの組で upsert する（同一セッションで二重行を作らない）", async () => {
    const arg = await run({
      flawIds: ["FLAW-01"],
      validSpanIds: ["VALID-01"],
      components: [],
    });

    expect(arg.where).toEqual({
      session_id_step_id: { session_id: "session-1", step_id: "step-1" },
    });
    expect(arg.create.session_id).toBe("session-1");
    expect(arg.create.step_id).toBe("step-1");
  });

  it("操作的定義を文字列として同じ行に凍結する", async () => {
    const arg = await run({ flawIds: ["FLAW-01"], validSpanIds: [], components: [] });

    expect(arg.update.operationalization).toBe(RELIANCE_OPERATIONALIZATION);
    // ABI が CSR の補数でしかない（3指標が独立ではない）という制約を隠さない
    expect(RELIANCE_OPERATIONALIZATION).toContain("automation_bias_index");
    expect(RELIANCE_OPERATIONALIZATION).toContain("独立ではない");
  });

  it("本実装では ABI が CSR の補数になる（README・コメントの但し書きと実装が一致していること）", async () => {
    const arg = await run({
      flawIds: ["FLAW-01", "FLAW-02", "FLAW-03"],
      validSpanIds: [],
      components: [component("flaw_detection", "FLAW-02")],
    });

    const csr = arg.update.correct_self_reliance as number;
    const abi = arg.update.automation_bias_index as number;
    expect(csr + abi).toBeCloseTo(1, 10);
  });
});
