import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordVerificationFocusSequence, resolveSessionContext } = vi.hoisted(() => ({
  recordVerificationFocusSequence: vi.fn(),
  resolveSessionContext: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  recordVerificationFocusSequence,
  resolveSessionContext,
}));

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/dialogue/focus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const VALID_ITEM = {
  focusSeq: 1,
  lineStart: 10,
  lineEnd: 14,
  selectedText: "verifyToken(token)",
  note: "失効の扱い",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  resolveSessionContext.mockResolvedValue({ session_id: "session-1" });
  recordVerificationFocusSequence.mockResolvedValue(1);
});

describe("正常系", () => {
  it("検証箇所と順序を記録する", async () => {
    const res = await post({ sessionId: "session-1", focusItems: [VALID_ITEM] });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.recordedCount).toBe(1);
    expect(recordVerificationFocusSequence).toHaveBeenCalledWith("session-1", [VALID_ITEM]);
  });

  it("行番号と注記は省略できる", async () => {
    const minimal = { focusSeq: 0, selectedText: "x-key-version" };
    const res = await post({ sessionId: "session-1", focusItems: [minimal] });

    expect(res.status).toBe(200);
    expect(recordVerificationFocusSequence).toHaveBeenCalledWith("session-1", [minimal]);
  });

  it("空配列は記録0件として通す", async () => {
    recordVerificationFocusSequence.mockResolvedValue(0);
    const res = await post({ sessionId: "session-1", focusItems: [] });

    expect(res.status).toBe(200);
  });
});

describe("ボディの検証（以前はここが素通しで createMany へ流れていた）", () => {
  it.each([
    ["sessionId 欠落", { focusItems: [VALID_ITEM] }],
    ["focusItems が配列でない", { sessionId: "session-1", focusItems: "verifyToken" }],
    ["focusItems 欠落", { sessionId: "session-1" }],
  ])("%s は 400 で弾く", async (_label, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(recordVerificationFocusSequence).not.toHaveBeenCalled();
  });

  it.each([
    ["focusSeq が文字列", { ...VALID_ITEM, focusSeq: "1" }],
    ["focusSeq が小数", { ...VALID_ITEM, focusSeq: 1.5 }],
    ["focusSeq が負", { ...VALID_ITEM, focusSeq: -1 }],
    ["selectedText が空", { ...VALID_ITEM, selectedText: "" }],
    ["selectedText が空白のみ", { ...VALID_ITEM, selectedText: "   " }],
    ["selectedText が文字列でない", { ...VALID_ITEM, selectedText: { code: "x" } }],
    ["lineStart が文字列", { ...VALID_ITEM, lineStart: "10" }],
  ])("要素の %s は 400 で弾く", async (_label, item) => {
    const res = await post({ sessionId: "session-1", focusItems: [item] });

    expect(res.status).toBe(400);
    expect(recordVerificationFocusSequence).not.toHaveBeenCalled();
  });

  it("1件でも不正な要素が混じっていれば、正しい要素も含めて記録しない", async () => {
    const res = await post({
      sessionId: "session-1",
      focusItems: [VALID_ITEM, { focusSeq: 2 }],
    });

    expect(res.status).toBe(400);
    expect(recordVerificationFocusSequence).not.toHaveBeenCalled();
  });

  it("件数の上限を超える配列を弾く（際限なく積ませない）", async () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      focusSeq: i,
      selectedText: "span",
    }));

    const res = await post({ sessionId: "session-1", focusItems: items });

    expect(res.status).toBe(400);
  });

  it("スキーマ違反の詳細をクライアントへ返さない", async () => {
    const res = await post({ sessionId: "session-1", focusItems: [{ focusSeq: 1 }] });
    const json = await res.json();

    expect(json.error).not.toContain("selectedText");
    expect(json.invalidRequest).toBe(true);
  });

  it("未知のセッションでは記録しない", async () => {
    resolveSessionContext.mockRejectedValue(new Error("Unknown session_id: session-x"));

    const res = await post({ sessionId: "session-x", focusItems: [VALID_ITEM] });

    expect(res.status).toBe(500);
    expect(recordVerificationFocusSequence).not.toHaveBeenCalled();
  });
});
