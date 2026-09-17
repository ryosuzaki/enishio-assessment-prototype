import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_opts: { apiKey: string }) {}
  },
}));

import { getInjectedFlaws } from "@/data/dynamic-task.server";
import { getDynamicTask } from "@/data/dynamic-task";
import {
  EVIDENCE_TARGETS,
  EVIDENCE_TARGET_LABELS,
  MAX_PROBES_PER_SESSION,
  MEDIATOR_MODEL_VERSION,
  MediationUnavailableError,
  PROBE_MOVES,
  PROBE_MOVE_LABELS,
  getMediatorModel,
  getMediatorModelVersion,
  selectProbe,
} from "./index";

const ENV_KEYS = ["OPENAI_API_KEY", "MEDIATOR_MODEL", "LLM_MODEL"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  createMock.mockReset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

const SELECTION = {
  state_estimate: EVIDENCE_TARGETS.map((target) => ({
    target,
    status: "not_elicited" as const,
    basis: "まだ言及がない",
  })),
  probe_move: "deepen_rationale" as const,
  probe_text: "その判断は何を根拠にしていますか。",
  selection_rationale: "tradeoff_reasoning が未取得のため",
};

function llmResponse(payload: unknown) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

const TASK = getDynamicTask("TASK-FINTECH-AUTH-01");

function baseParams(overrides: Partial<Parameters<typeof selectProbe>[0]> = {}) {
  return {
    transcript: [{ turnSeq: 1, role: "user", content: "この実装、失効まわりが気になります" }],
    businessRequirements: TASK.business_requirements,
    constraints: TASK.constraints,
    contextDocuments: [{ title: "決済チームSlack", type: "slack" }],
    probesSoFar: [],
    ...overrides,
  };
}

describe("打てる手と根拠カテゴリの定義", () => {
  it("すべての手にラベルがある（UI とスキーマがずれない）", () => {
    for (const move of PROBE_MOVES) {
      expect(PROBE_MOVE_LABELS[move]).toBeTruthy();
    }
    expect(Object.keys(PROBE_MOVE_LABELS)).toHaveLength(PROBE_MOVES.length);
  });

  it("「問わない」を明示的な選択肢として持つ", () => {
    // 深掘りを打たなかったことも媒介方針の一部として記録するため、none が要る
    expect(PROBE_MOVES).toContain("none");
  });

  it("すべての根拠カテゴリにラベルがある", () => {
    for (const target of EVIDENCE_TARGETS) {
      expect(EVIDENCE_TARGET_LABELS[target]).toBeTruthy();
    }
    expect(Object.keys(EVIDENCE_TARGET_LABELS)).toHaveLength(EVIDENCE_TARGETS.length);
  });

  it("1セッションあたりの深掘り上限は 4 手（MVP 2.1 ステップ7の3〜4ターン）", () => {
    expect(MAX_PROBES_PER_SESSION).toBe(4);
  });
});

describe("メディエーターモデルの解決", () => {
  it("MEDIATOR_MODEL が LLM_MODEL より優先される", () => {
    process.env.LLM_MODEL = "model-from-llm";
    process.env.MEDIATOR_MODEL = "model-from-mediator";
    expect(getMediatorModel()).toBe("model-from-mediator");
  });

  it("MEDIATOR_MODEL が無ければ LLM_MODEL へ落ち、どちらも無ければ既定へ落ちる", () => {
    process.env.LLM_MODEL = "model-from-llm";
    expect(getMediatorModel()).toBe("model-from-llm");

    delete process.env.LLM_MODEL;
    expect(getMediatorModel()).toBe("gpt-5.6-luna");
  });

  it("記録に使う定数 MEDIATOR_MODEL_VERSION が関数の返り値と食い違っていない", () => {
    expect(MEDIATOR_MODEL_VERSION).toBe(getMediatorModelVersion());
    expect(getMediatorModelVersion()).toContain("/probe-v2");
  });
});

describe("APIキーが無いときは定型文で代替しない", () => {
  it("MediationUnavailableError を投げ、LLM を呼ばない", async () => {
    await expect(selectProbe(baseParams())).rejects.toBeInstanceOf(MediationUnavailableError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("プレースホルダのままのキーも未設定として扱う", async () => {
    process.env.OPENAI_API_KEY = "your-openai-api-key-here";
    await expect(selectProbe(baseParams())).rejects.toBeInstanceOf(MediationUnavailableError);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("selectProbe に渡す文脈", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    createMock.mockResolvedValue(llmResponse(SELECTION));
  });

  it("受講者にも見えている業務要件・制約・関連ドキュメント・対話ログを渡す", async () => {
    await selectProbe(baseParams());

    const messages = createMock.mock.calls[0][0].messages;
    const userPrompt = messages[1].content as string;

    expect(userPrompt).toContain(TASK.business_requirements[0]);
    expect(userPrompt).toContain(TASK.constraints[0]);
    expect(userPrompt).toContain("決済チームSlack");
    expect(userPrompt).toContain("この実装、失効まわりが気になります");
  });

  it("これまでに打った手を渡す（同じ手を続けて打たせないため）", async () => {
    await selectProbe(baseParams({ probesSoFar: ["deepen_rationale", "what_if"] }));

    const userPrompt = createMock.mock.calls[0][0].messages[1].content as string;
    expect(userPrompt).toContain("deepen_rationale → what_if");
  });

  it("1手も打っていないことも明示して渡す", async () => {
    await selectProbe(baseParams({ probesSoFar: [] }));

    const userPrompt = createMock.mock.calls[0][0].messages[1].content as string;
    expect(userPrompt).toContain("まだ1手も投げていない");
  });

  it("関連ドキュメントはタイトルと種別だけを渡し、本文を渡さない", async () => {
    await selectProbe(baseParams());

    const userPrompt = createMock.mock.calls[0][0].messages[1].content as string;
    const docBody = (TASK.context_documents ?? [])[0]?.content;
    expect(docBody).toBeTruthy();
    expect(userPrompt).not.toContain(docBody as string);
  });

  it("役割の境界はシステムプロンプトに置き、打てる手を全部列挙している", async () => {
    await selectProbe(baseParams());

    const messages = createMock.mock.calls[0][0].messages;
    expect(messages[0].role).toBe("system");

    const systemPrompt = messages[0].content as string;
    // 手を増やしてシステムプロンプトを直し忘れると、その手はモデルから選ばれない
    for (const move of PROBE_MOVES) {
      expect(systemPrompt).toContain(move);
    }
  });

  it("Structured Outputs の型拘束をかけて呼ぶ", async () => {
    await selectProbe(baseParams());

    const call = createMock.mock.calls[0][0];
    expect(call.response_format?.type).toBe("json_schema");
    expect(call.max_completion_tokens).toBeGreaterThan(0);
  });
});

describe("正答鍵を媒介へ渡さない（誘出であって誘導ではない）", () => {
  it("プロンプトに仕込み不備の位置・説明が1件も含まれない", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    createMock.mockResolvedValue(llmResponse(SELECTION));

    await selectProbe(baseParams());

    const wholeCall = JSON.stringify(createMock.mock.calls[0][0]);
    const flaws = getInjectedFlaws("TASK-FINTECH-AUTH-01");
    expect(flaws.length).toBeGreaterThan(0);

    for (const flaw of flaws) {
      expect(wholeCall).not.toContain(flaw.span_text);
      expect(wholeCall).not.toContain(flaw.description);
      expect(wholeCall).not.toContain(flaw.flaw_id);
    }
  });

  it("モジュール自体がサーバ専用の正答鍵モジュールを import していない", () => {
    // 渡す・渡さないの判断を呼び出し側に委ねると、いつか渡される。
    // 依存そのものを持たないことが [D-28] の担保になっている。
    const source = fs.readFileSync(path.join(import.meta.dirname, "index.ts"), "utf-8");
    expect(source).not.toMatch(/^\s*import[^\n]*dynamic-task\.server/m);
  });
});

describe("構造化出力の検証", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("正常な出力をそのまま返す", async () => {
    createMock.mockResolvedValue(llmResponse(SELECTION));
    const result = await selectProbe(baseParams());

    expect(result.probe_move).toBe("deepen_rationale");
    expect(result.state_estimate).toHaveLength(EVIDENCE_TARGETS.length);
    expect(result.selection_rationale).toBeTruthy();
  });

  it("出力が空なら定型文で埋めずに投げる", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: null } }] });
    await expect(selectProbe(baseParams())).rejects.toBeInstanceOf(MediationUnavailableError);
  });

  it("定義に無い手を通さない", async () => {
    createMock.mockResolvedValue(llmResponse({ ...SELECTION, probe_move: "give_the_answer" }));
    await expect(selectProbe(baseParams())).rejects.toBeInstanceOf(MediationUnavailableError);
  });

  it("定義に無い根拠カテゴリを通さない", async () => {
    createMock.mockResolvedValue(
      llmResponse({
        ...SELECTION,
        state_estimate: [{ target: "vibes", status: "partial", basis: "なんとなく" }],
      })
    );
    await expect(selectProbe(baseParams())).rejects.toBeInstanceOf(MediationUnavailableError);
  });

  it("選定理由が欠けた出力を通さない（監査できなくなるため）", async () => {
    const { selection_rationale: _omitted, ...withoutRationale } = SELECTION;
    createMock.mockResolvedValue(llmResponse(withoutRationale));
    await expect(selectProbe(baseParams())).rejects.toBeInstanceOf(MediationUnavailableError);
  });
});
