import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { selectProbe } = vi.hoisted(() => ({ selectProbe: vi.fn() }));
const { recordMediationProbe, recordPromptTurn, recordLlmCall, resolveSessionContext } =
  vi.hoisted(() => ({
    recordMediationProbe: vi.fn(),
    recordPromptTurn: vi.fn(),
    recordLlmCall: vi.fn(),
    resolveSessionContext: vi.fn(),
  }));
const { mediationProbeFindMany, promptTurnFindMany } = vi.hoisted(() => ({
  mediationProbeFindMany: vi.fn(),
  promptTurnFindMany: vi.fn(),
}));

vi.mock("@/lib/mediator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mediator")>()),
  selectProbe,
}));

vi.mock("@/lib/telemetry", () => ({
  recordMediationProbe,
  recordPromptTurn,
  recordLlmCall,
  resolveSessionContext,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mediationProbe: { findMany: mediationProbeFindMany },
    promptTurn: { findMany: promptTurnFindMany },
  },
}));

import { EVIDENCE_TARGETS, MAX_PROBES_PER_SESSION, MediationUnavailableError } from "@/lib/mediator";
import { getDynamicTask } from "@/data/dynamic-task";
import { getInjectedFlaws } from "@/data/dynamic-task.server";
import { POST } from "./route";

const TASK_ID = "TASK-FINTECH-AUTH-01";
const TASK = getDynamicTask(TASK_ID);

const SELECTION = {
  state_estimate: EVIDENCE_TARGETS.map((target) => ({
    target,
    status: "not_elicited" as const,
    basis: "まだ言及がない",
  })),
  probe_move: "what_if" as const,
  probe_text: "前提が変わったら、その指摘は変わりますか。",
  selection_rationale: "robustness_under_changed_premise が未取得のため",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/dialogue/probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { sessionId: "session-1", taskId: TASK_ID, turnSeq: 5, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  resolveSessionContext.mockResolvedValue({
    session_id: "session-1",
    learner_id: "learner-1",
    session_seq: 1,
  });
  mediationProbeFindMany.mockResolvedValue([]);
  promptTurnFindMany.mockResolvedValue([
    { turn_seq: 1, role: "user", content: "失効まわりが気になります" },
  ]);
  recordMediationProbe.mockResolvedValue({});
  recordPromptTurn.mockResolvedValue({});
  recordLlmCall.mockResolvedValue({});
  selectProbe.mockResolvedValue(SELECTION);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("入力の検証", () => {
  it.each([
    ["sessionId 欠落", { sessionId: undefined }],
    ["taskId 欠落", { taskId: undefined }],
    ["turnSeq が数値でない", { turnSeq: "5" }],
  ])("%s は 400 で弾く", async (_label, overrides) => {
    const res = await post(validBody(overrides));

    expect(res.status).toBe(400);
    expect(selectProbe).not.toHaveBeenCalled();
  });

  it("未知の task_id では深掘りを打たず、内部の例外文を返さない", async () => {
    const res = await post(validBody({ taskId: "TASK-DOES-NOT-EXIST" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Probe selection failed");
    expect(selectProbe).not.toHaveBeenCalled();
    expect(recordMediationProbe).not.toHaveBeenCalled();
  });
});

describe("深掘りの回数上限", () => {
  it("上限に達していたら選択器を呼ばずに打ち切る", async () => {
    mediationProbeFindMany.mockResolvedValue(
      Array.from({ length: MAX_PROBES_PER_SESSION }, () => ({ probe_move: "deepen_rationale" }))
    );

    const json = await (await post(validBody())).json();

    expect(json.probeIssued).toBe(false);
    expect(json.reason).toBe("max_probes_reached");
    expect(json.probesSoFar).toBe(MAX_PROBES_PER_SESSION);
    expect(selectProbe).not.toHaveBeenCalled();
  });

  it("「問わない（none）」は手数に数えない", async () => {
    mediationProbeFindMany.mockResolvedValue([
      { probe_move: "deepen_rationale" },
      { probe_move: "none" },
      { probe_move: "none" },
      { probe_move: "none" },
      { probe_move: "none" },
    ]);

    const json = await (await post(validBody())).json();

    expect(selectProbe).toHaveBeenCalledOnce();
    expect(json.probeIssued).toBe(true);
    // 実際に打った手は1手なので、次は2手目になる
    expect(json.probesSoFar).toBe(2);
  });

  it("上限の1手前なら打てる", async () => {
    mediationProbeFindMany.mockResolvedValue(
      Array.from({ length: MAX_PROBES_PER_SESSION - 1 }, () => ({ probe_move: "what_if" }))
    );

    const json = await (await post(validBody())).json();

    expect(json.probeIssued).toBe(true);
    expect(json.probesSoFar).toBe(MAX_PROBES_PER_SESSION);
  });

  it("これまでの手番はクライアントの申告ではなくサーバのログから読む", async () => {
    await post(validBody({ probesSoFar: [] }));

    expect(mediationProbeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { session_id: "session-1" } })
    );
    expect(selectProbe.mock.calls[0][0].probesSoFar).toEqual([]);
  });
});

describe("打った手の記録", () => {
  it("問いを対話ログへ mediator ロールで残す（AI同僚と混ぜない）", async () => {
    const json = await (await post(validBody())).json();

    expect(json.probeIssued).toBe(true);
    expect(json.probeText).toBe(SELECTION.probe_text);

    expect(recordPromptTurn).toHaveBeenCalledOnce();
    const [sessionId, turnSeq, role, content, modelVersion] = recordPromptTurn.mock.calls[0];
    expect(sessionId).toBe("session-1");
    expect(turnSeq).toBe(5);
    expect(role).toBe("mediator");
    expect(content).toBe(SELECTION.probe_text);
    expect(modelVersion).toBeTruthy();
  });

  it("状態推定と選定理由を必ず残す（なぜその問いを選んだかが監査できること）", async () => {
    await post(validBody());

    expect(recordMediationProbe).toHaveBeenCalledOnce();
    const record = recordMediationProbe.mock.calls[0][0];
    expect(record.probeMove).toBe("what_if");
    expect(record.selectionRationale).toBe(SELECTION.selection_rationale);
    expect(record.stateEstimate.targets).toHaveLength(EVIDENCE_TARGETS.length);
    expect(record.mediatorModelVersion).toBeTruthy();
  });

  it("「問わない」と判断した場合も記録するが、対話ログには流さない", async () => {
    selectProbe.mockResolvedValue({ ...SELECTION, probe_move: "none", probe_text: "" });

    const json = await (await post(validBody())).json();

    expect(json.probeIssued).toBe(false);
    expect(json.reason).toBe("no_probe_needed");
    // 打たなかったことも媒介方針の一部として残す
    expect(recordMediationProbe).toHaveBeenCalledOnce();
    expect(recordMediationProbe.mock.calls[0][0].probeMove).toBe("none");
    // ただし受講者には何も投げていないので対話ログには入れない
    expect(recordPromptTurn).not.toHaveBeenCalled();
  });

  it("手は選ばれたのに問いが空白だけなら、投げなかったものとして扱う", async () => {
    selectProbe.mockResolvedValue({ ...SELECTION, probe_text: "   " });

    const json = await (await post(validBody())).json();

    expect(json.probeIssued).toBe(false);
    expect(recordPromptTurn).not.toHaveBeenCalled();
  });
});

describe("選択器へ渡す情報の範囲", () => {
  it("受講者の画面に出ている要件・制約と、サーバのログから読んだ対話だけを渡す", async () => {
    await post(validBody());

    const arg = selectProbe.mock.calls[0][0];
    expect(arg.businessRequirements).toEqual(TASK.business_requirements);
    expect(arg.constraints).toEqual(TASK.constraints);
    expect(arg.transcript).toEqual([
      { turnSeq: 1, role: "user", content: "失効まわりが気になります" },
    ]);
  });

  it("関連ドキュメントはタイトルと種別だけを渡す", async () => {
    await post(validBody());

    const docs = selectProbe.mock.calls[0][0].contextDocuments;
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(Object.keys(doc).sort()).toEqual(["title", "type"]);
    }
  });

  it("正答鍵はこのルートを一切通らない", async () => {
    await post(validBody());

    const payload = JSON.stringify(selectProbe.mock.calls[0][0]);
    for (const flaw of getInjectedFlaws(TASK_ID)) {
      expect(payload).not.toContain(flaw.flaw_id);
      expect(payload).not.toContain(flaw.span_text);
      expect(payload).not.toContain(flaw.description);
    }
  });
});

describe("深掘りできないときは定型文で埋めない", () => {
  it("503 を返し、対話ログにも mediation_probes にも何も残さない", async () => {
    selectProbe.mockRejectedValue(
      new MediationUnavailableError("OPENAI_API_KEY が設定されていないため深掘りを実行できません。")
    );

    const res = await post(validBody());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.mediationUnavailable).toBe(true);
    expect(json.error).toContain("OPENAI_API_KEY");
    expect(recordMediationProbe).not.toHaveBeenCalled();
    expect(recordPromptTurn).not.toHaveBeenCalled();
  });
});
