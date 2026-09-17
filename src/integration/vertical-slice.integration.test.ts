/**
 * 縦切り1本を、**実際の PostgreSQL に書きながら**端から端まで通す結合テスト。
 *
 * # なぜ要るか
 *
 * E2E（Playwright）は全APIルートをモックしているため、実証しているのは画面遷移だけである。
 * 単体テストはDBをモックしているため、実証しているのは呼び出し引数だけである。
 * **「サーバのコードがDBに対して本当に正しく書けているか」を通しで見るのはここしかない。**
 *
 * ここでしか見えないもの:
 * - `sessions` の `(learner_id, session_seq)` 一意制約と採番リトライが実際に効くか
 * - `ratings.rating_category` が本当に nullable で、`pending_human` の行が保存できるか
 * - `anchor_responses` の `(session_id, anchor_id)` 一意制約が二重回答を止めるか
 * - `evidence_components` / `reliance_metrics` が評点と同じ行へ正しく紐づくか
 * - 外部キー（`anchor_responses → anchor_items`）が未投入の項目を弾くか
 *
 * # LLM は呼ばない
 *
 * 課金の発生する経路を CI に入れない。`openai` をモジュールごと差し替えてある。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_opts: { apiKey: string }) {}
  },
}));

import { prisma } from "@/lib/db";
import { generateLearnerId } from "@/lib/telemetry";
import { getInjectedFlaws } from "@/data/dynamic-task.server";
import { getDynamicTask } from "@/data/dynamic-task";
import { levenshtein } from "@/lib/edit-distance";
import { EVIDENCE_TARGETS } from "@/lib/mediator";

import { POST as sessionStart } from "@/app/api/session/start/route";
import { POST as sessionBlur } from "@/app/api/session/blur/route";
import { POST as dialogueStart } from "@/app/api/dialogue/start/route";
import { POST as dialogueTurn } from "@/app/api/dialogue/turn/route";
import { POST as dialogueProbe } from "@/app/api/dialogue/probe/route";
import { POST as dialogueFocus } from "@/app/api/dialogue/focus/route";
import { POST as preliminaryJudgement } from "@/app/api/dialogue/preliminary-judgement/route";
import { POST as dialogueEvaluate } from "@/app/api/dialogue/evaluate/route";
import { POST as feedback } from "@/app/api/feedback/route";
import { POST as anchorResponse } from "@/app/api/anchor/route";

const TASK_ID = "TASK-FINTECH-AUTH-01";
const STEP_ID = `step-dynamic-${TASK_ID}`;
const TEST_ANCHOR_ID = "ANCHOR-INTEGRATION-TEST";
const TENANT = "integration-test-tenant";

/** 受講者が編集した後の成果物。編集距離の算出対象になる。 */
const EDITED_ARTIFACT = "const a = 1;";

/** 実行ごとに別の受講者を作る。並行実行や再実行で前回の行とぶつからないようにする。 */
const RAW_USER_ID = `integration-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const LEARNER_ID = generateLearnerId(TENANT, RAW_USER_ID);

function post(handler: (req: Request) => Promise<Response>, body: unknown) {
  return handler(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function json(res: Response) {
  return (await res.json()) as Record<string, any>;
}

function llmResponse(payload: unknown) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

const AI_PEER_REPLY = {
  reply: "レート制限のキーは加盟店IDで切っています。失効の扱いは仕様外でした。",
  updated_artifact: null,
};

const PROBE_SELECTION = {
  state_estimate: EVIDENCE_TARGETS.map((target) => ({
    target,
    status: "partial" as const,
    basis: "根拠が途中までしか出ていない",
  })),
  probe_move: "trace_grounding" as const,
  probe_text: "その懸念は、提示されている要件のどこから来ていますか。",
  selection_rationale: "requirement_grounding が未取得のため",
};

/** FLAW-01 は摘発、VALID-01 は過剰指摘、FLAW-02 は見逃し */
const EVIDENCE = {
  components: [
    {
      turn_index: 1,
      quoted_span: "失効したトークンが24時間通ってしまうのでは",
      component_type: "flaw_detection",
      grounding: "tied_to_requirement",
      injected_flaw_id: "FLAW-01",
      rationale_summary: "要件2の即時失効へ接続した指摘",
    },
    {
      turn_index: 1,
      quoted_span: "この鍵バージョンの後方互換は危ないのでは",
      component_type: "false_positive_critique",
      grounding: "asserted",
      injected_flaw_id: "VALID-01",
      rationale_summary: "正当なローテーション設計への過剰指摘",
    },
  ],
  identified_flaws_count: 1,
  avoided_false_positives: false,
  probe_consistency: { score: 0.8, rationale: "深掘りへの応答が直前の発言と整合している" },
};

function scoring(confidence: number, ratingCategory = 3) {
  return {
    axis_id: "axis_4" as const,
    rating_category: ratingCategory,
    scoring_confidence: confidence,
    evidence_summary: "失効未考慮を要件へ接続して指摘している",
    diagnostic_feedback: "正常箇所の妥当性判断まで踏み込みたい",
  };
}

let sessionId = "";
let ratingId = "";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL が設定されていません。結合テストは実DBを要します（docker compose up -d）。"
    );
  }
  // ルート側のキー有無チェックを通すためのダミー。実際の呼び出しはモックが受ける。
  process.env.OPENAI_API_KEY = "integration-test-key";
  delete process.env.HITL_DEMO_CONFIDENCE_THRESHOLD;

  // アンカー応答は anchor_items への外部キーを持つ。シード済みの項目を汚さないよう
  // このテスト専用の項目を1件だけ立てる。
  await prisma.anchorItem.upsert({
    where: { anchor_id: TEST_ANCHOR_ID },
    update: {},
    create: {
      anchor_id: TEST_ANCHOR_ID,
      family: "integration",
      anchor_status: "pretest",
      content: { note: "結合テスト用" },
    },
  });
});

afterAll(async () => {
  // learners からのカスケードで、このテストが作った行はすべて消える。
  // tenants は Restrict なので learners を消した後でしか消せない（[D-67] 決定2）。
  await prisma.learner.deleteMany({ where: { learner_id: LEARNER_ID } });
  await prisma.tenant.deleteMany({ where: { tenant_namespace: TENANT } });
  await prisma.anchorItem.deleteMany({ where: { anchor_id: TEST_ANCHOR_ID } });
  await prisma.$disconnect();
});

describe("縦切り: セッション開始から評価レポート・異議申立まで", () => {
  it("1. セッションを開始すると learners と sessions に行ができる", async () => {
    const res = await post(sessionStart, { tenantNamespace: TENANT, userId: RAW_USER_ID });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.learnerId).toBe(LEARNER_ID);
    expect(body.sessionSeq).toBe(1);

    sessionId = body.sessionId;

    const session = await prisma.session.findUniqueOrThrow({ where: { session_id: sessionId } });
    expect(session.learner_id).toBe(LEARNER_ID);
    expect(session.session_seq).toBe(1);
    expect(session.window_blur_duration_sec).toBe(0);
  });

  it("1b. 受講者がテナントへ紐づく（learner_id の採番根拠が表としても残る）", async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { tenant_namespace: TENANT },
    });
    const learner = await prisma.learner.findUniqueOrThrow({ where: { learner_id: LEARNER_ID } });

    expect(learner.tenant_id).toBe(tenant.tenant_id);
  });

  it("1c. 受講者が残っているテナントは削除できない（記録の帰属先は個人・[D-67] 決定2）", async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { tenant_namespace: TENANT },
    });

    await expect(
      prisma.tenant.delete({ where: { tenant_id: tenant.tenant_id } })
    ).rejects.toThrow();

    // 受講者も消えていない
    expect(await prisma.learner.count({ where: { learner_id: LEARNER_ID } })).toBe(1);
  });

  it("2. 課題開始で、仕込み不備と『正常箇所』の両方が injected_flaw_map へ確定する", async () => {
    const res = await post(dialogueStart, { sessionId, taskId: TASK_ID });
    const body = await json(res);

    expect(res.status).toBe(200);

    const rows = await prisma.injectedFlawMap.findMany({ where: { session_id: sessionId } });
    const expected = getInjectedFlaws(TASK_ID);
    expect(rows).toHaveLength(expected.length);

    // 正常箇所のラベルが無いと、過剰指摘と正しい摘発を後から区別できない [P-15]
    expect(rows.filter((r) => !r.is_flaw).length).toBeGreaterThan(0);
    expect(body.normalSpanCount).toBe(rows.filter((r) => !r.is_flaw).length);

    // 仕込み内容そのものはレスポンスへ返さない（クライアントは受検者の画面である）
    const raw = JSON.stringify(body);
    for (const flaw of expected) {
      expect(raw).not.toContain(flaw.span_text);
    }
  });

  it("3. 対話1往復で prompt_turns が残り、編集距離はサーバ側の算出値になる", async () => {
    createMock.mockResolvedValueOnce(llmResponse(AI_PEER_REPLY));

    const res = await post(dialogueTurn, {
      sessionId,
      taskId: TASK_ID,
      turnSeq: 1,
      userMessage: "失効したトークンが24時間通ってしまうのでは",
      currentArtifactText: EDITED_ARTIFACT,
      // クライアントが申告してきた値。**採用してはならない。**
      editDistance: 999999,
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.assistantMessage).toBe(AI_PEER_REPLY.reply);

    const turns = await prisma.promptTurn.findMany({
      where: { session_id: sessionId },
      orderBy: { turn_seq: "asc" },
    });
    expect(turns.map((t) => [t.turn_seq, t.role])).toEqual([
      [1, "user"],
      [2, "assistant"],
    ]);

    const series = await prisma.artifactEditDistanceSeries.findMany({
      where: { session_id: sessionId },
    });
    expect(series).toHaveLength(1);
    // 初回の比較対象は課題の初版ドラフト（受講者が最初に見た状態）
    const task = getDynamicTask(TASK_ID);
    expect(series[0].edit_distance).toBe(levenshtein(task.initial_ai_draft, EDITED_ARTIFACT));
    expect(series[0].edit_distance).not.toBe(999999);
    expect(series[0].current_text).toBe(EDITED_ARTIFACT);
  });

  it("3b. 2回目以降は直前に記録したテキストとの差分になる", async () => {
    createMock.mockResolvedValueOnce(llmResponse(AI_PEER_REPLY));

    const secondArtifact = `${EDITED_ARTIFACT}\n// 失効チェックを追加`;
    await post(dialogueTurn, {
      sessionId,
      taskId: TASK_ID,
      turnSeq: 3,
      userMessage: "失効チェックを足してください",
      currentArtifactText: secondArtifact,
    });

    const series = await prisma.artifactEditDistanceSeries.findMany({
      where: { session_id: sessionId },
      orderBy: { timestamp: "asc" },
    });
    expect(series).toHaveLength(2);
    // 初版ドラフトではなく、1回目に記録したテキストからの差分であること
    expect(series[1].edit_distance).toBe(levenshtein(EDITED_ARTIFACT, secondArtifact));
  });

  it("4. 深掘りは mediator ロールで対話ログへ入り、状態推定と選定理由も残る", async () => {
    createMock.mockResolvedValueOnce(llmResponse(PROBE_SELECTION));

    const res = await post(dialogueProbe, { sessionId, taskId: TASK_ID, turnSeq: 5 });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.probeIssued).toBe(true);

    const probes = await prisma.mediationProbe.findMany({ where: { session_id: sessionId } });
    expect(probes).toHaveLength(1);
    expect(probes[0].probe_move).toBe("trace_grounding");
    expect(probes[0].selection_rationale).toBe(PROBE_SELECTION.selection_rationale);
    expect(probes[0].state_estimate).toMatchObject({ targets: expect.any(Array) });

    // AI同僚と同じ role にまとめると、受講者が検証したのか問われたのかが分離できなくなる
    const mediatorTurn = await prisma.promptTurn.findUniqueOrThrow({
      where: { session_id_turn_seq: { session_id: sessionId, turn_seq: 5 } },
    });
    expect(mediatorTurn.role).toBe("mediator");
    expect(mediatorTurn.content).toBe(PROBE_SELECTION.probe_text);
  });

  it("5. 検証対象として選んだ箇所と順序が残る", async () => {
    const res = await post(dialogueFocus, {
      sessionId,
      focusItems: [
        { focusSeq: 1, lineStart: 10, lineEnd: 14, selectedText: "verifyToken(token)", note: "失効" },
        { focusSeq: 2, selectedText: "x-key-version", note: "鍵バージョン" },
      ],
    });

    expect(res.status).toBe(200);

    const rows = await prisma.verificationFocusSequence.findMany({
      where: { session_id: sessionId },
      orderBy: { focus_seq: "asc" },
    });
    expect(rows.map((r) => r.focus_seq)).toEqual([1, 2]);
    expect(rows[0].line_start).toBe(10);
  });

  it("6. 画面外滞在時間は加算されるだけで、判定には使われない", async () => {
    await post(sessionBlur, { sessionId, deltaSec: 30 });
    await post(sessionBlur, { sessionId, deltaSec: 12 });

    const session = await prisma.session.findUniqueOrThrow({ where: { session_id: sessionId } });
    expect(session.window_blur_duration_sec).toBe(42);
  });

  it("6b. 異常な滞在時間は記録せず、セッションも壊さない", async () => {
    const res = await post(sessionBlur, { sessionId, deltaSec: 60 * 60 * 5 });
    const body = await json(res);

    expect(body.recorded).toBe(false);
    const session = await prisma.session.findUniqueOrThrow({ where: { session_id: sessionId } });
    expect(session.window_blur_duration_sec).toBe(42);
  });

  it("7. CFF の事前判断は理由つきで記録され、理由が空なら保存されない", async () => {
    const rejected = await post(preliminaryJudgement, {
      sessionId,
      stepId: STEP_ID,
      action: "comment",
      justification: "   ",
    });
    expect(rejected.status).toBe(400);

    const res = await post(preliminaryJudgement, {
      sessionId,
      stepId: STEP_ID,
      action: "comment",
      justification: "失効の扱いだけ条件付きで通す",
    });
    expect(res.status).toBe(200);

    const rows = await prisma.learnerPreliminaryJudgement.findMany({
      where: { session_id: sessionId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("comment");
    expect(rows[0].justification).toBe("失効の扱いだけ条件付きで通す");
  });

  it("8. AutoSCORE が評点・根拠要素・適正依存指標を同じセッションへ書き切る", async () => {
    createMock
      .mockResolvedValueOnce(llmResponse(EVIDENCE))
      .mockResolvedValueOnce(llmResponse(scoring(0.82, 3)));

    const res = await post(dialogueEvaluate, {
      sessionId,
      taskId: TASK_ID,
      transcript: [{ turnSeq: 1, role: "user", content: "失効したトークンが24時間通ってしまうのでは" }],
      finalArtifact: "const a = 1;",
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.isPendingHumanReview).toBe(false);
    ratingId = body.ratingId;

    // 評点の正本
    const rating = await prisma.rating.findUniqueOrThrow({ where: { rating_id: ratingId } });
    expect(rating.rating_category).toBe(3);
    expect(rating.rater_type).toBe("llm");
    expect(rating.learner_id).toBe(LEARNER_ID);
    expect(rating.session_seq).toBe(1);
    expect(rating.stimulus_type).toBe("generated");
    expect(rating.stakes_context).toBe("formative");
    expect(rating.probe_consistency_score).toBeCloseTo(0.8, 5);
    expect(rating.scorer_model_version).toContain("/extract-");

    // 根拠そのものが評点と同じ rating_id に紐づいて残る
    const components = await prisma.evidenceComponent.findMany({ where: { rating_id: ratingId } });
    expect(components).toHaveLength(2);
    expect(components.map((c) => c.injected_flaw_id).sort()).toEqual(["FLAW-01", "VALID-01"]);

    // 適正依存: 不備2件中1件を摘発（CSR 0.5）、正常箇所1件を過剰指摘（CAR 0）
    const metrics = await prisma.relianceMetrics.findUniqueOrThrow({
      where: { session_id_step_id: { session_id: sessionId, step_id: STEP_ID } },
    });
    expect(metrics.correct_self_reliance).toBeCloseTo(0.5, 5);
    expect(metrics.automation_bias_index).toBeCloseTo(0.5, 5);
    expect(metrics.correct_ai_reliance).toBeCloseTo(0, 5);
    expect(metrics.flaw_span_count).toBe(2);
    expect(metrics.valid_span_count).toBe(1);
    expect(metrics.operationalization).toContain("独立ではない");
  });

  it("8b. LLM 呼び出しの使用量とレイテンシがセッション単位で残る（原価をログから答えられる）", async () => {
    const calls = await prisma.llmCall.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: "asc" },
    });

    // 対話・深掘り・採点2段の4種すべてが記録されている（採点分だけ数えると原価を取り違える）
    const purposes = new Set(calls.map((c) => c.purpose));
    expect(purposes).toContain("dialogue");
    expect(purposes).toContain("probe");
    expect(purposes).toContain("extract");
    expect(purposes).toContain("score");

    for (const call of calls) {
      expect(call.model).toBeTruthy();
      expect(call.latency_ms).toBeGreaterThanOrEqual(0);
    }

    // モックのレスポンスに usage を積んでいないので値は null。**列と経路があることを確かめる。**
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it("9. 異議申立が評点へ紐づいて残る", async () => {
    const res = await post(feedback, {
      ratingId,
      sessionId,
      disagreementDirection: "evidence_wrong",
      freeTextReason: "鍵バージョンの指摘は過剰指摘ではないと考える",
      scorerModelVersion: "test-version",
    });

    expect(res.status).toBe(200);

    const rows = await prisma.scoreFeedback.findMany({ where: { rating_id: ratingId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_role).toBe("learner");
    expect(rows[0].disagreement_direction).toBe("evidence_wrong");
  });
});

describe("確信度が足りない判定を確定させない（実スキーマ上の検証）", () => {
  it("rating_category = null・rater_type = pending_human の行が実際に保存できる", async () => {
    createMock
      .mockResolvedValueOnce(llmResponse(EVIDENCE))
      .mockResolvedValueOnce(llmResponse(scoring(0.4, 2)));

    const body = await json(
      await post(dialogueEvaluate, {
        sessionId,
        taskId: TASK_ID,
        transcript: [{ turnSeq: 1, role: "user", content: "念のため確認です" }],
        finalArtifact: "const a = 1;",
      })
    );

    expect(body.isPendingHumanReview).toBe(true);
    expect(body.ratingCategory).toBeNull();

    const rating = await prisma.rating.findUniqueOrThrow({ where: { rating_id: body.ratingId } });
    expect(rating.rating_category).toBeNull();
    expect(rating.rater_type).toBe("pending_human");
    // モデルが提示していたバンドは監査のため残す（確定値ではない）
    expect(rating.stimulus_features).toMatchObject({ proposed_rating_category: 2 });
    // 自己申告の確信度そのものは改変しない
    expect(rating.scoring_confidence).toBeCloseTo(0.4, 5);
  });
});

describe("アンカーは無得点で記録する", () => {
  it("anchor_responses に入り、ratings には行が増えない", async () => {
    const before = await prisma.rating.count({ where: { session_id: sessionId } });

    const res = await post(anchorResponse, {
      sessionId,
      anchorId: TEST_ANCHOR_ID,
      formatVersion: "v2-sct",
      stage1Selection: "B",
      stage2Selection: "C",
      stage3Selection: 0,
      stage2Order: "C,A,D,B",
      confidence: 4,
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.scored).toBe(false);

    const rows = await prisma.anchorResponse.findMany({ where: { session_id: sessionId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].format_version).toBe("v2-sct");
    expect(rows[0].stage2_order).toBe("C,A,D,B");
    // 「動かなかった（0）」は最も重要な応答なので、未回答として潰してはならない
    expect(rows[0].stage3_selection).toBe(0);

    // アンカーに 0 点を入れるとルーブリックの Level 0 と区別できなくなる
    expect(await prisma.rating.count({ where: { session_id: sessionId } })).toBe(before);
  });

  it("同じ項目への二重回答は一意制約で止まり、409 が返って1回目が上書きされない", async () => {
    const res = await post(anchorResponse, {
      sessionId,
      anchorId: TEST_ANCHOR_ID,
      formatVersion: "v2-sct",
      stage1Selection: "A",
      stage3Selection: 2,
      confidence: 5,
    });
    const body = await json(res);

    // サーバ障害ではなく競合である。実DBが返す P2002 を 409 へ写せているかはここでしか見えない
    expect(res.status).toBe(409);
    expect(body.alreadyAnswered).toBe(true);

    const rows = await prisma.anchorResponse.findMany({ where: { session_id: sessionId } });
    expect(rows).toHaveLength(1);
    // 1回目（初見での回答）がそのまま残っている
    expect(rows[0].stage1_selection).toBe("B");
    expect(rows[0].stage3_selection).toBe(0);
  });

  it("anchor_items に無い項目IDは外部キー違反になる前に 409 で止まる", async () => {
    const res = await post(anchorResponse, {
      sessionId,
      anchorId: "ANCHOR-NOT-SEEDED",
      formatVersion: "v2-sct",
      stage1Selection: "A",
      stage3Selection: 1,
      confidence: 3,
    });

    expect(res.status).toBe(409);
  });
});

describe("session_seq の採番", () => {
  it("同じ受講者の2回目のセッションは seq=2 になる", async () => {
    const body = await json(
      await post(sessionStart, { tenantNamespace: TENANT, userId: RAW_USER_ID })
    );

    expect(body.learnerId).toBe(LEARNER_ID);
    expect(body.sessionSeq).toBe(2);
  });

  it("同時に開始しても seq が重複せず、連番になる", async () => {
    // (learner_id, session_seq) の一意制約とリトライが実際に効いているかは、
    // 実DBへ同時に投げないと分からない
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        post(sessionStart, { tenantNamespace: TENANT, userId: RAW_USER_ID }).then(json)
      )
    );

    expect(results.every((r) => r.success)).toBe(true);

    const sessions = await prisma.session.findMany({
      where: { learner_id: LEARNER_ID },
      orderBy: { session_seq: "asc" },
      select: { session_seq: true },
    });
    const seqs = sessions.map((s) => s.session_seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs).toEqual(Array.from({ length: seqs.length }, (_, i) => i + 1));
  });
});
