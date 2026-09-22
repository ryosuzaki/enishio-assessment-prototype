import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// LLM の2段階呼び出しと DB 書き込みだけを差し替える。閾値判定・記録内容の組み立て・
// 正答鍵の分割はルート自身の責務なので実物を通す。
const { extractEvidence, computeBandScore } = vi.hoisted(() => ({
  extractEvidence: vi.fn(),
  computeBandScore: vi.fn(),
}));

const {
  recordRating,
  resolveSessionContext,
  recordEvidenceComponents,
  recordRelianceMetrics,
  recordLlmCall,
  completeSession,
} = vi.hoisted(() => ({
  recordRating: vi.fn(),
  resolveSessionContext: vi.fn(),
  recordEvidenceComponents: vi.fn(),
  recordRelianceMetrics: vi.fn(),
  recordLlmCall: vi.fn(),
  completeSession: vi.fn(),
}));

const { transactionMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(async (cb: (tx: any) => Promise<any>) => cb({ txSentinel: true })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/evaluator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/evaluator")>()),
  extractEvidence,
  computeBandScore,
}));

vi.mock("@/lib/telemetry", () => ({
  recordRating,
  resolveSessionContext,
  recordEvidenceComponents,
  recordRelianceMetrics,
  recordLlmCall,
  completeSession,
}));

import { SCORER_MODEL_VERSION, ScoringUnavailableError } from "@/lib/evaluator";
import { POST } from "./route";

const TASK_ID = "TASK-FINTECH-AUTH-01";

const EVIDENCE = {
  components: [
    {
      turn_index: 3,
      quoted_span: "失効済みトークンが通ってしまう",
      component_type: "flaw_detection",
      grounding: "tied_to_requirement",
      injected_flaw_id: "FLAW-01",
      rationale_summary: "要件2へ接続した指摘",
    },
  ],
  identified_flaws_count: 1,
  avoided_false_positives: false,
  probe_consistency: { score: null, rationale: "MEDIATOR の発話が無い" },
};

function scoring(confidence: number, ratingCategory = 3) {
  return {
    axis_id: "axis_4" as const,
    rating_category: ratingCategory,
    scoring_confidence: confidence,
    evidence_summary: "根拠の要約",
    diagnostic_feedback: "診断コメント",
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/dialogue/evaluate", {
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
    transcript: [{ turnSeq: 1, role: "user", content: "この署名検証は失効を見ていないのでは" }],
    finalArtifact: "（最終成果物）",
    ...overrides,
  };
}

/** recordRating に渡った引数 */
function recordedRating() {
  expect(recordRating).toHaveBeenCalledOnce();
  return recordRating.mock.calls[0][0];
}

let savedThresholdEnv: string | undefined;

beforeEach(() => {
  savedThresholdEnv = process.env.HITL_DEMO_CONFIDENCE_THRESHOLD;
  delete process.env.HITL_DEMO_CONFIDENCE_THRESHOLD;

  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  resolveSessionContext.mockResolvedValue({
    session_id: "session-1",
    learner_id: "learner-from-session",
    session_seq: 7,
  });
  recordRating.mockResolvedValue({ rating_id: "rating-1", stakes_context: "formative" });
  recordEvidenceComponents.mockResolvedValue(1);
  recordRelianceMetrics.mockResolvedValue({});
  recordLlmCall.mockResolvedValue({});
  completeSession.mockResolvedValue({ session_id: "session-1" });
  extractEvidence.mockResolvedValue(EVIDENCE);
  computeBandScore.mockResolvedValue(scoring(0.82));
});

afterEach(() => {
  if (savedThresholdEnv === undefined) delete process.env.HITL_DEMO_CONFIDENCE_THRESHOLD;
  else process.env.HITL_DEMO_CONFIDENCE_THRESHOLD = savedThresholdEnv;
  vi.restoreAllMocks();
});

describe("入力の検証", () => {
  it.each([
    ["sessionId 欠落", { sessionId: undefined }],
    ["taskId 欠落", { taskId: undefined }],
    ["transcript 欠落", { transcript: undefined }],
    ["transcript が配列でない", { transcript: "ログ全文" }],
  ])("%s は 400 で弾き、LLM も DB も触らない", async (_label, overrides) => {
    const res = await post(validBody(overrides));

    expect(res.status).toBe(400);
    expect(extractEvidence).not.toHaveBeenCalled();
    expect(recordRating).not.toHaveBeenCalled();
  });

  it("未知の task_id では採点も記録もせず、内部の例外文をクライアントへ返さない", async () => {
    const res = await post(validBody({ taskId: "TASK-DOES-NOT-EXIST" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Evaluation failed");
    // 例外メッセージ（Unknown dynamic task_id: ...）が外へ出ていないこと
    expect(json.error).not.toContain("task_id");
    expect(extractEvidence).not.toHaveBeenCalled();
    expect(recordRating).not.toHaveBeenCalled();
  });
});

describe("確信度の閾値（pending_human への分岐）", () => {
  it("閾値ちょうど（0.70）は確定させる——下回ったときだけ保留する", async () => {
    computeBandScore.mockResolvedValue(scoring(0.7, 4));

    const res = await post(validBody());
    const json = await res.json();

    expect(json.isPendingHumanReview).toBe(false);
    expect(json.ratingCategory).toBe(4);
    expect(json.levelLabel).toContain("Level 4");

    const rating = recordedRating();
    expect(rating.raterType).toBe("llm");
    expect(rating.ratingCategory).toBe(4);
  });

  it("閾値をわずかに下回れば保留し、バンドを確定させない", async () => {
    computeBandScore.mockResolvedValue(scoring(0.6999, 4));

    const res = await post(validBody());
    const json = await res.json();

    expect(json.isPendingHumanReview).toBe(true);
    expect(json.ratingCategory).toBeNull();
    expect(json.levelLabel).toBeNull();

    const rating = recordedRating();
    expect(rating.raterType).toBe("pending_human");
    expect(rating.ratingCategory).toBeNull();
    expect(rating.raterId).toBe("awaiting-human-review");
  });

  it("保留でもモデルの自己申告確信度はそのまま記録する（改変しない）", async () => {
    computeBandScore.mockResolvedValue(scoring(0.42, 2));

    const json = await (await post(validBody())).json();

    expect(json.scoringConfidence).toBe(0.42);
    expect(recordedRating().scoringConfidence).toBe(0.42);
  });

  it("保留時はモデルが提示していたバンドを監査用に残す", async () => {
    computeBandScore.mockResolvedValue(scoring(0.42, 2));
    await post(validBody());

    expect(recordedRating().stimulusFeatures.proposed_rating_category).toBe(2);
  });

  it("確定時は proposed_rating_category を残さない（確定値と紛れるため）", async () => {
    computeBandScore.mockResolvedValue(scoring(0.9, 5));
    await post(validBody());

    expect(recordedRating().stimulusFeatures.proposed_rating_category).toBeUndefined();
  });

  it("デモ用の閾値上書きは閾値だけを動かし、上書き中であることを応答に明示する", async () => {
    process.env.HITL_DEMO_CONFIDENCE_THRESHOLD = "0.99";
    computeBandScore.mockResolvedValue(scoring(0.82, 3));

    const json = await (await post(validBody())).json();

    expect(json.confidenceThreshold).toBe(0.99);
    expect(json.isDemoThresholdOverride).toBe(true);
    expect(json.isPendingHumanReview).toBe(true);
    // 確信度そのものは上書きされていない
    expect(json.scoringConfidence).toBe(0.82);
    expect(recordedRating().scoringConfidence).toBe(0.82);
  });

  it("上書きが無いときは既定の 0.70 を応答へ返し、上書き扱いにしない", async () => {
    const json = await (await post(validBody())).json();

    expect(json.confidenceThreshold).toBe(0.7);
    expect(json.isDemoThresholdOverride).toBe(false);
  });
});

describe("クライアントの申告を評点の帰属に使わない", () => {
  it("learner_id と session_seq はリクエストボディではなくセッションから引く", async () => {
    await post(
      validBody({ learnerId: "learner-spoofed-by-client", sessionSeq: 999 })
    );

    expect(resolveSessionContext).toHaveBeenCalledWith("session-1");
    const rating = recordedRating();
    expect(rating.learnerId).toBe("learner-from-session");
    expect(rating.sessionSeq).toBe(7);
  });

  it("未知のセッションでは採点結果を記録しない", async () => {
    resolveSessionContext.mockRejectedValue(new Error("Unknown session_id: session-x"));

    const res = await post(validBody());

    expect(res.status).toBe(500);
    expect(recordRating).not.toHaveBeenCalled();
  });
});

describe("2段階分離と正答鍵の扱い", () => {
  it("第2段階には第1段階の構造化出力だけを渡す（対話ログを回さない）", async () => {
    await post(validBody());

    expect(computeBandScore).toHaveBeenCalledWith(EVIDENCE, TASK_ID, expect.any(Function));
    expect(JSON.stringify(computeBandScore.mock.calls[0])).not.toContain(
      "この署名検証は失効を見ていないのでは"
    );
  });

  it("適正依存の指標には、サーバ側の正答鍵を is_flaw で分けて渡す", async () => {
    await post(validBody());

    expect(recordRelianceMetrics).toHaveBeenCalledOnce();
    const arg = recordRelianceMetrics.mock.calls[0][0];

    // TASK-FINTECH-AUTH-01 は仕込み不備2件＋正常箇所1件
    expect(arg.flawIds).toEqual(["FLAW-01", "FLAW-02"]);
    expect(arg.validSpanIds).toEqual(["VALID-01"]);
    expect(arg.stepId).toBe(`step-dynamic-${TASK_ID}`);
  });

  it("評点だけでなく根拠要素そのものを、評点と同じ rating_id で永続化する", async () => {
    await post(validBody());

    expect(recordEvidenceComponents).toHaveBeenCalledWith(
      "rating-1",
      "session-1",
      [
        {
          turnIndex: 3,
          quotedSpan: "失効済みトークンが通ってしまう",
          componentType: "flaw_detection",
          grounding: "tied_to_requirement",
          injectedFlawId: "FLAW-01",
          rationaleSummary: "要件2へ接続した指摘",
        },
      ],
      expect.anything()
    );
  });

  it("採点に使ったモデルとプロンプト版を評点へ記録する", async () => {
    await post(validBody());

    const rating = recordedRating();
    expect(rating.scorerModelVersion).toBe(SCORER_MODEL_VERSION);
    expect(rating.stimulusType).toBe("generated");
    expect(rating.anchorId).toBeNull();
    expect(rating.axisId).toBe("axis_4");
  });

  it("深掘りが1手も入っていないセッションでは probe_consistency を null のまま記録する", async () => {
    await post(validBody());

    // 0 を入れると「一貫していなかった」と「そもそも問うていない」が区別できなくなる
    expect(recordedRating().probeConsistencyScore).toBeNull();
  });

  it("深掘りがあった場合はその一貫性スコアを記録する", async () => {
    extractEvidence.mockResolvedValue({
      ...EVIDENCE,
      probe_consistency: { score: 0.75, rationale: "整合している" },
    });

    await post(validBody());

    expect(recordedRating().probeConsistencyScore).toBe(0.75);
  });
});

describe("トークン使用量の記録", () => {
  /** 採点器が実際に onUsage を呼ぶ挙動を模す */
  function withUsage(stage: "extract" | "score", tokens: number) {
    return async (...args: unknown[]) => {
      const onUsage = args[args.length - 1] as ((u: unknown) => void) | undefined;
      onUsage?.({
        purpose: stage,
        model: "model-x",
        promptTokens: tokens,
        completionTokens: 100,
        reasoningTokens: 400,
        totalTokens: tokens + 100,
        latencyMs: 1234,
      });
      return stage === "extract" ? EVIDENCE : scoring(0.82);
    };
  }

  it("2段階ぶんの使用量をセッションへ記録する", async () => {
    extractEvidence.mockImplementation(withUsage("extract", 4000));
    computeBandScore.mockImplementation(withUsage("score", 1500));

    await post(validBody());

    expect(recordLlmCall).toHaveBeenCalledTimes(2);
    expect(recordLlmCall.mock.calls[0][0]).toBe("session-1");
    expect(recordLlmCall.mock.calls.map((c) => c[1].purpose)).toEqual(["extract", "score"]);
    expect(recordLlmCall.mock.calls[0][1].promptTokens).toBe(4000);
    // 推論トークンは completion とは別立てで残す
    expect(recordLlmCall.mock.calls[0][1].reasoningTokens).toBe(400);
  });

  it("第2段階が落ちても、第1段階ぶんの使用量は記録する（失敗にも課金は発生している）", async () => {
    extractEvidence.mockImplementation(withUsage("extract", 4000));
    computeBandScore.mockRejectedValue(new ScoringUnavailableError("score", "落ちた"));

    const res = await post(validBody());

    expect(res.status).toBe(503);
    expect(recordLlmCall).toHaveBeenCalledOnce();
    expect(recordLlmCall.mock.calls[0][1].purpose).toBe("extract");
  });
});

describe("採点できないときは採点しない", () => {
  it("第1段階が落ちたら 503 を返し、評点を1行も作らない", async () => {
    extractEvidence.mockRejectedValue(
      new ScoringUnavailableError("extract", "OPENAI_API_KEY が設定されていないため採点できません。")
    );

    const res = await post(validBody());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.scoringUnavailable).toBe(true);
    expect(json.stage).toBe("extract");
    // 文面を自分で書いたエラーはそのまま返してよい
    expect(json.error).toContain("OPENAI_API_KEY");
    expect(recordRating).not.toHaveBeenCalled();
    expect(computeBandScore).not.toHaveBeenCalled();
  });

  it("第2段階が落ちたら 503 を返し、第1段階の結果だけで評点を作らない", async () => {
    computeBandScore.mockRejectedValue(
      new ScoringUnavailableError("score", "構造化出力がスキーマに適合しませんでした")
    );

    const res = await post(validBody());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.stage).toBe("score");
    expect(recordRating).not.toHaveBeenCalled();
    expect(recordEvidenceComponents).not.toHaveBeenCalled();
    expect(recordRelianceMetrics).not.toHaveBeenCalled();
  });
});

describe("トランザクション化とセッション完了・用途の記録 (RV-E2, RV-K11, RV-A10)", () => {
  it("prisma.$transaction を介して評点・根拠・適正依存・セッション完了を不可分に記録する (RV-E2, RV-K11)", async () => {
    const res = await post(validBody());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(transactionMock).toHaveBeenCalledOnce();
    // 各記録関数にトランザクションクライアント txSentinel が渡されていること
    expect(recordRating).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ txSentinel: true })
    );
    expect(recordEvidenceComponents).toHaveBeenCalledWith(
      "rating-1",
      "session-1",
      expect.any(Array),
      expect.objectContaining({ txSentinel: true })
    );
    expect(recordRelianceMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-1" }),
      expect.objectContaining({ txSentinel: true })
    );
    expect(completeSession).toHaveBeenCalledWith(
      "session-1",
      expect.any(Date),
      expect.objectContaining({ txSentinel: true })
    );
    expect(json.stakesContext).toBe("formative");
  });

  it("リクエストで stakesContext が指定された場合は recordRating に伝達しレスポンスにも含める (RV-A10)", async () => {
    recordRating.mockResolvedValue({ rating_id: "rating-1", stakes_context: "promotion" });

    const res = await post(validBody({ stakesContext: "promotion" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(recordedRating().stakesContext).toBe("promotion");
    expect(json.stakesContext).toBe("promotion");
  });
});
