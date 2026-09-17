import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_opts: { apiKey: string }) {}
  },
}));

const { recordPromptTurn, recordEditDistance, recordLlmCall, resolveSessionContext } = vi.hoisted(
  () => ({
    recordPromptTurn: vi.fn(),
    recordEditDistance: vi.fn(),
    recordLlmCall: vi.fn(),
    resolveSessionContext: vi.fn(),
  })
);
vi.mock("@/lib/telemetry", () => ({
  recordPromptTurn,
  recordEditDistance,
  recordLlmCall,
  resolveSessionContext,
}));

const { editSeriesFindFirst, promptTurnFindMany } = vi.hoisted(() => ({
  editSeriesFindFirst: vi.fn(),
  promptTurnFindMany: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    artifactEditDistanceSeries: { findFirst: editSeriesFindFirst },
    promptTurn: { findMany: promptTurnFindMany },
  },
}));

import { getDynamicTask } from "@/data/dynamic-task";
import { levenshtein } from "@/lib/edit-distance";
import { MAX_ARTIFACT_CHARS, MAX_USER_MESSAGE_CHARS } from "@/lib/request-validation";
import { POST } from "./route";

const TASK_ID = "TASK-FINTECH-AUTH-01";
const TASK = getDynamicTask(TASK_ID);
const EDITED = "const a = 1;";

const AI_REPLY = { reply: "そこは仕様外でした。", updated_artifact: null };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/dialogue/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "session-1",
    taskId: TASK_ID,
    turnSeq: 1,
    userMessage: "失効の扱いが要件2と食い違っていませんか",
    currentArtifactText: EDITED,
    ...overrides,
  };
}

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  resolveSessionContext.mockResolvedValue({ session_id: "session-1" });
  recordPromptTurn.mockResolvedValue({});
  recordEditDistance.mockResolvedValue({});
  recordLlmCall.mockResolvedValue({});
  editSeriesFindFirst.mockResolvedValue(null);
  promptTurnFindMany.mockResolvedValue([]);
  createMock.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(AI_REPLY) } }],
  });
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedKey;
  vi.restoreAllMocks();
});

describe("編集距離をクライアントの申告で決めない", () => {
  it("ボディの editDistance を無視し、サーバが算出した値を記録する", async () => {
    await post(validBody({ editDistance: 999999 }));

    expect(recordEditDistance).toHaveBeenCalledOnce();
    const [, distance] = recordEditDistance.mock.calls[0];
    expect(distance).toBe(levenshtein(TASK.initial_ai_draft, EDITED));
    expect(distance).not.toBe(999999);
  });

  it("記録が1件も無ければ課題の初版ドラフトを比較対象にする", async () => {
    editSeriesFindFirst.mockResolvedValue(null);

    await post(validBody());

    expect(recordEditDistance.mock.calls[0][1]).toBe(
      levenshtein(TASK.initial_ai_draft, EDITED)
    );
  });

  it("2回目以降は直前に記録したテキストを比較対象にする", async () => {
    editSeriesFindFirst.mockResolvedValue({ current_text: "const a = 0;" });

    await post(validBody());

    expect(recordEditDistance.mock.calls[0][1]).toBe(levenshtein("const a = 0;", EDITED));
  });

  it("成果物が未送信なら初版ドラフトとみなし、距離は 0 になる", async () => {
    await post(validBody({ currentArtifactText: undefined }));

    expect(recordEditDistance.mock.calls[0][1]).toBe(0);
  });

  it("成果物の全文もあわせて記録する（比較判断の経路のため）", async () => {
    await post(validBody());

    expect(recordEditDistance.mock.calls[0][2]).toBe(EDITED);
  });
});

describe("ボディの検証", () => {
  it.each([
    ["sessionId 欠落", { sessionId: undefined }],
    ["taskId 欠落", { taskId: undefined }],
    ["userMessage が空", { userMessage: "" }],
    ["userMessage が空白のみ", { userMessage: "   " }],
    ["turnSeq が負", { turnSeq: -1 }],
    ["turnSeq が小数", { turnSeq: 1.5 }],
    ["currentArtifactText が文字列でない", { currentArtifactText: 42 }],
  ])("%s は 400 で弾き、記録も LLM 呼び出しもしない", async (_label, overrides) => {
    const res = await post(validBody(overrides));

    expect(res.status).toBe(400);
    expect(recordPromptTurn).not.toHaveBeenCalled();
    expect(recordEditDistance).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("上限を超える発言を弾く（プロンプトへ素通しさせない）", async () => {
    const res = await post(validBody({ userMessage: "あ".repeat(MAX_USER_MESSAGE_CHARS + 1) }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("上限を超える成果物を弾く", async () => {
    const res = await post(validBody({ currentArtifactText: "x".repeat(MAX_ARTIFACT_CHARS + 1) }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("JSON として読めないボディを 400 で弾く", async () => {
    const res = await POST(
      new Request("http://localhost/api/dialogue/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{壊れたJSON",
      })
    );

    expect(res.status).toBe(400);
  });

  it("スキーマ違反の詳細をクライアントへ返さない", async () => {
    const res = await post(validBody({ userMessage: "" }));
    const json = await res.json();

    expect(json.error).not.toContain("userMessage");
    expect(json.invalidRequest).toBe(true);
  });

  it("未知の task_id では黙って別課題にすり替えない", async () => {
    const res = await post(validBody({ taskId: "TASK-DOES-NOT-EXIST" }));

    expect(res.status).toBe(500);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("対話ターンの記録", () => {
  it("受講者の発言を user ロールで、AI同僚の応答を assistant ロールで残す", async () => {
    const body = await (await post(validBody())).json();

    expect(body.assistantTurnSeq).toBe(2);
    expect(recordPromptTurn.mock.calls[0].slice(0, 4)).toEqual([
      "session-1",
      1,
      "user",
      "失効の扱いが要件2と食い違っていませんか",
    ]);
    expect(recordPromptTurn.mock.calls[1].slice(0, 4)).toEqual([
      "session-1",
      2,
      "assistant",
      AI_REPLY.reply,
    ]);
  });

  it("丸呑みの合図にはインターロックを返し、LLM を呼ばない", async () => {
    const body = await (await post(validBody({ userMessage: "了解" }))).json();

    expect(body.isInterlockTriggered).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
    // インターロックでも編集距離は測っておく（そのターンで手を入れたかは残る）
    expect(recordEditDistance).toHaveBeenCalledOnce();
  });

  it("APIキーが無ければ 503 を返し、AI同僚の応答をでっち上げない", async () => {
    process.env.OPENAI_API_KEY = "your-openai-api-key-here";

    const res = await post(validBody());

    expect(res.status).toBe(503);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("対話履歴はサーバのログから読み、mediator を AI同僚の発話に混ぜない", async () => {
    promptTurnFindMany.mockResolvedValue([
      { turn_seq: 1, role: "user", content: "受講者の発言" },
      { turn_seq: 2, role: "mediator", content: "進行役の問い" },
      { turn_seq: 3, role: "assistant", content: "AI同僚の返答" },
    ]);

    await post(validBody());

    const userContent = createMock.mock.calls[0][0].messages[1].content as string;
    expect(userContent).toContain("受講者: 受講者の発言");
    expect(userContent).toContain("第三者の進行役: 進行役の問い");
    expect(userContent).toContain("あなた: AI同僚の返答");
  });
});
