import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LLM_MODEL,
  LLM_MAX_RETRIES,
  LLM_TIMEOUT_MS,
  createLlmClient,
  getDialogueModel,
  isLlmKeyMissing,
  measured,
  resolveModel,
  usageFrom,
  type LlmUsage,
} from "./llm";

const ENV_KEYS = ["LLM_MODEL", "DIALOGUE_MODEL"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe("モデルの解決", () => {
  it("既定モデルの定義は1箇所だけ（用途ごとに文字列を散らさない）", () => {
    expect(DEFAULT_LLM_MODEL).toBeTruthy();
    expect(resolveModel(undefined)).toBe(DEFAULT_LLM_MODEL);
  });

  it("用途別 → LLM_MODEL → 既定値 の順で解決する", () => {
    process.env.LLM_MODEL = "from-llm-model";
    expect(resolveModel(undefined)).toBe("from-llm-model");
    expect(resolveModel("from-purpose")).toBe("from-purpose");
  });

  it("空文字の用途別指定は未設定として扱う", () => {
    process.env.LLM_MODEL = "from-llm-model";
    expect(resolveModel("")).toBe("from-llm-model");
  });

  it("DIALOGUE_MODEL が AI同僚の応答モデルになる", () => {
    process.env.LLM_MODEL = "from-llm-model";
    process.env.DIALOGUE_MODEL = "from-dialogue";
    expect(getDialogueModel()).toBe("from-dialogue");
  });
});

describe("APIキーの判定", () => {
  it.each([
    [undefined, true],
    ["", true],
    ["your-openai-api-key-here", true],
    ["sk-real-looking-key", false],
  ])("%s → 未設定判定 %s", (key, expected) => {
    expect(isLlmKeyMissing(key as string | undefined)).toBe(expected);
  });
});

describe("クライアントの設定", () => {
  it("タイムアウトとリトライを既定任せにしない", () => {
    const client = createLlmClient("sk-test");

    expect(client.timeout).toBe(LLM_TIMEOUT_MS);
    expect(client.maxRetries).toBe(LLM_MAX_RETRIES);
    expect(LLM_TIMEOUT_MS).toBeGreaterThan(0);
    expect(LLM_MAX_RETRIES).toBeGreaterThanOrEqual(0);
  });
});

describe("使用量の取り出し", () => {
  it("入力・出力・合計トークンとレイテンシを取り出す", () => {
    const usage = usageFrom(
      { usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 } },
      "extract",
      "model-x",
      842
    );

    expect(usage).toEqual({
      purpose: "extract",
      model: "model-x",
      promptTokens: 1200,
      completionTokens: 300,
      reasoningTokens: null,
      totalTokens: 1500,
      latencyMs: 842,
    });
  });

  it("推論トークンを completion とは別立てで取り出す", () => {
    // 見える出力が短いのに請求が膨らむ原因はここ。合算すると後から切り分けられない。
    const usage = usageFrom(
      {
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 5000,
          total_tokens: 6000,
          completion_tokens_details: { reasoning_tokens: 4400 },
        },
      },
      "score",
      "model-x",
      10
    );

    expect(usage.reasoningTokens).toBe(4400);
    expect(usage.completionTokens).toBe(5000);
  });

  it("usage が無いレスポンスでも落ちず、値は null になる", () => {
    const usage = usageFrom({ choices: [] }, "dialogue", "model-x", 5);

    expect(usage.promptTokens).toBeNull();
    expect(usage.completionTokens).toBeNull();
    expect(usage.totalTokens).toBeNull();
    expect(usage.latencyMs).toBe(5);
  });

  it("レスポンスが null でも落ちない", () => {
    expect(() => usageFrom(null, "probe", "model-x", 1)).not.toThrow();
  });

  it("数値でない値を数値として拾わない", () => {
    const usage = usageFrom({ usage: { prompt_tokens: "1200" } }, "extract", "model-x", 1);

    expect(usage.promptTokens).toBeNull();
  });
});

describe("measured", () => {
  it("呼び出し結果をそのまま返し、使用量を通知する", async () => {
    const collected: LlmUsage[] = [];
    const result = await measured(
      "dialogue",
      "model-x",
      async () => ({ usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }, ok: 1 }),
      (u) => collected.push(u)
    );

    expect(result.ok).toBe(1);
    expect(collected).toHaveLength(1);
    expect(collected[0].purpose).toBe("dialogue");
    expect(collected[0].model).toBe("model-x");
    expect(collected[0].promptTokens).toBe(10);
    expect(collected[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("コールバックが無くても呼び出しは通る（ライブラリ側はDBを知らない）", async () => {
    await expect(measured("probe", "model-x", async () => ({ ok: true }))).resolves.toEqual({
      ok: true,
    });
  });

  it("呼び出しが落ちたら例外をそのまま投げ、使用量は通知しない", async () => {
    const onUsage = vi.fn();

    await expect(
      measured("score", "model-x", async () => {
        throw new Error("upstream failed");
      }, onUsage)
    ).rejects.toThrow("upstream failed");

    expect(onUsage).not.toHaveBeenCalled();
  });
});
