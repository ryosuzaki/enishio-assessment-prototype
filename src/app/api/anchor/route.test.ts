import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadAnchorBank } = vi.hoisted(() => ({ loadAnchorBank: vi.fn() }));
const { recordAnchorResponse, resolveSessionContext } = vi.hoisted(() => ({
  recordAnchorResponse: vi.fn(),
  resolveSessionContext: vi.fn(),
}));
const { anchorItemFindUnique } = vi.hoisted(() => ({ anchorItemFindUnique: vi.fn() }));

// 鍵を落とす処理（toLearnerFacingAnchor）そのものを検証したいので、バンクの読み込みだけ
// 差し替えて実物の整形を通す。
vi.mock("@/lib/anchor-bank", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/anchor-bank")>()),
  loadAnchorBank,
}));

vi.mock("@/lib/telemetry", () => ({ recordAnchorResponse, resolveSessionContext }));

vi.mock("@/lib/db", () => ({
  prisma: { anchorItem: { findUnique: anchorItemFindUnique } },
}));

import type { AnchorRecordV2 } from "@/lib/anchor-bank";
import { RETIRED_BANK_WARNING } from "@/lib/anchor-bank";
import { GET, POST } from "./route";

/** 受検者へ漏れてはならない文字列をすべて含む項目 */
const SEEDED: AnchorRecordV2 = {
  anchor_id: "ANCHOR-TEST-01",
  format_version: "v2-sct",
  family: "family-A",
  anchor_status: "pretest",
  item_kind: "seeded_premise",
  title: "テスト項目",
  intro: "導入文",
  proposal: "提案文",
  hidden_premise: "HIDDEN_PREMISE_SECRET",
  stage1: {
    question: "この提案を採用してよいか",
    note: "STAGE1_NOTE_SECRET",
    options: [
      { key: "A", text: "採用する" },
      { key: "B", text: "条件付きで採用する", note: "OPTION_NOTE_SECRET" },
      { key: "C", text: "採用しない" },
    ],
    correct_key: "C",
  },
  stage2: {
    question: "懸念はどこにあるか",
    note: "STAGE2_NOTE_SECRET",
    options: [
      { key: "A", text: "整合性", note: "OPTION_NOTE_SECRET" },
      { key: "B", text: "可用性" },
      { key: "C", text: "監査証跡" },
      { key: "D", text: "性能" },
    ],
  },
  stage3: {
    new_information: "新しい情報",
    question: "判断は動くか",
    scale: [
      { value: -2, label: "強く否定へ" },
      { value: 0, label: "変わらない" },
      { value: 2, label: "強く肯定へ" },
    ],
    panel: {
      status: "mock",
      n: 5,
      distribution: { "-2": 1, "0": 2, "2": 2 },
      note: "PANEL_NOTE_SECRET",
    },
  },
  stage3b: {
    pushback: "それは考えすぎでは",
    question: "もう一度伺います",
    note: "STAGE3B_NOTE_SECRET",
    scoring: { rule: "SCORING_RULE_SECRET" },
  },
  confidence_scale: "1〜5",
  cheat_notes: "CHEAT_NOTES_SECRET",
  distractor_notes: "DISTRACTOR_NOTES_SECRET",
  metadata: "METADATA_SECRET",
};

/** 類型C（仕込んだ不備が無い項目）。段階2と段階3' を持たない。 */
const NO_DEFECT: AnchorRecordV2 = {
  ...SEEDED,
  anchor_id: "ANCHOR-TEST-02",
  item_kind: "no_defect",
  hidden_premise: null,
  stage2: null,
  stage3b: null,
};

const SECRETS = [
  "HIDDEN_PREMISE_SECRET",
  "STAGE1_NOTE_SECRET",
  "STAGE2_NOTE_SECRET",
  "OPTION_NOTE_SECRET",
  "PANEL_NOTE_SECRET",
  "STAGE3B_NOTE_SECRET",
  "SCORING_RULE_SECRET",
  "CHEAT_NOTES_SECRET",
  "DISTRACTOR_NOTES_SECRET",
  "METADATA_SECRET",
];

function get(url: string) {
  return GET(new Request(url));
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/anchor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  loadAnchorBank.mockReturnValue({ anchors: [SEEDED, NO_DEFECT], source: "demo_sample_v2" });
  resolveSessionContext.mockResolvedValue({
    session_id: "session-1",
    learner_id: "learner-1",
    session_seq: 1,
  });
  anchorItemFindUnique.mockResolvedValue({ anchor_status: "pretest" });
  recordAnchorResponse.mockResolvedValue({ response_id: "response-1", anchor_status: "pretest" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET — 採点鍵と設計意図を受検者へ返さない", () => {
  it("レスポンス全体に鍵となる文字列が1つも含まれない", async () => {
    const res = await get("http://localhost/api/anchor?id=ANCHOR-TEST-01");
    const raw = JSON.stringify(await res.json());

    // 画面に描画しなくても、レスポンスに載れば DevTools から読める
    for (const secret of SECRETS) {
      expect(raw).not.toContain(secret);
    }
  });

  it("段階1の正答キーを返さない", async () => {
    const json = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-01")).json();

    expect(json.anchor.stage1).not.toHaveProperty("correct_key");
    expect(json.anchor.stage1.options.map((o: { key: string }) => o.key).sort()).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("段階3の専門家パネル分布を返さず、鍵がダミーかどうかだけを返す", async () => {
    const json = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-01")).json();

    expect(json.anchor.stage3).not.toHaveProperty("panel");
    expect(json.anchor.stage3.panel_status).toBe("mock");
    expect(json.anchor.stage3.panel_n).toBe(5);
  });

  it("item_kind を返さない（類型Cと分かれば段階1が自明になる）", async () => {
    const seeded = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-01")).json();
    const noDefect = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-02")).json();

    expect(seeded.anchor).not.toHaveProperty("item_kind");
    expect(noDefect.anchor).not.toHaveProperty("item_kind");
  });

  it("段階3' は反論と設問だけを返し、設計意図（note / scoring）を落とす", async () => {
    const json = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-01")).json();

    expect(Object.keys(json.anchor.stage3b).sort()).toEqual(["pushback", "question"]);
  });

  it("選択肢は key と text だけにする", async () => {
    const json = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-01")).json();

    for (const option of [...json.anchor.stage1.options, ...json.anchor.stage2.options]) {
      expect(Object.keys(option).sort()).toEqual(["key", "text"]);
    }
  });
});

describe("GET — 段階2の提示順", () => {
  it("提示順を order として一緒に返す（記録しないと応答を解釈できない）", async () => {
    const json = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-01")).json();

    const presented = json.anchor.stage2.options.map((o: { key: string }) => o.key);
    expect(json.anchor.stage2_order).toBe(presented.join(","));
    expect(presented.slice().sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("段階1は順序に意味があるためシャッフルしない", async () => {
    const json = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-01")).json();

    expect(json.anchor.stage1.options.map((o: { key: string }) => o.key)).toEqual(["A", "B", "C"]);
  });

  it("類型C（段階2なし）では stage2 も stage2_order も null で返す", async () => {
    const json = await (await get("http://localhost/api/anchor?id=ANCHOR-TEST-02")).json();

    expect(json.anchor.stage2).toBeNull();
    expect(json.anchor.stage2_order).toBeNull();
    expect(json.anchor.stage3b).toBeNull();
  });
});

describe("GET — どのバンクを読んだかを明示する", () => {
  it("同梱サンプルであることを返す", async () => {
    const json = await (await get("http://localhost/api/anchor")).json();

    expect(json.bankSource).toBe("demo_sample_v2");
    expect(json.retiredWarning).toBeNull();
    expect(json.count).toBe(2);
  });

  it("退役形式を読んだ場合は較正に使えない旨を警告として返す", async () => {
    loadAnchorBank.mockReturnValue({ anchors: [SEEDED], source: "demo_sample_v1_retired" });

    const json = await (await get("http://localhost/api/anchor")).json();

    expect(json.retiredWarning).toBe(RETIRED_BANK_WARNING);
  });

  it("バンクが読めなければ 503 を返す（空の出題画面を出さない）", async () => {
    loadAnchorBank.mockReturnValue({ anchors: [], source: "missing" });

    const res = await get("http://localhost/api/anchor");

    expect(res.status).toBe(503);
  });

  it("存在しない項目IDは 404", async () => {
    const res = await get("http://localhost/api/anchor?id=ANCHOR-NOPE");

    expect(res.status).toBe(404);
  });
});

describe("POST — 応答の記録", () => {
  function v2Body(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: "session-1",
      anchorId: "ANCHOR-TEST-01",
      formatVersion: "v2-sct",
      stage1Selection: "B",
      stage2Selection: "C",
      stage3Selection: 1,
      stage3bSelection: 0,
      stage2Order: "C,A,D,B",
      stage1DurationMs: 1200,
      stage2DurationMs: 900,
      stage3DurationMs: 1500,
      stage3bDurationMs: 700,
      confidence: 4,
      ...overrides,
    };
  }

  it("無得点で記録し、評点（ratings）を作らない", async () => {
    const json = await (await post(v2Body())).json();

    expect(json.success).toBe(true);
    expect(json.scored).toBe(false);
    expect(recordAnchorResponse).toHaveBeenCalledOnce();
    // アンカーに 0 点を入れるとルーブリックの Level 0 と区別できなくなる
    expect(recordAnchorResponse.mock.calls[0][0]).not.toHaveProperty("ratingCategory");
  });

  it("段階2の提示順を応答と一緒に記録する", async () => {
    await post(v2Body());

    expect(recordAnchorResponse.mock.calls[0][0].stage2Order).toBe("C,A,D,B");
  });

  it("段階3の回答が 0（変わらない）でも受け付ける", async () => {
    // 0 を未回答として弾くと「動かなかった」という最も重要な応答が落ちる
    const res = await post(v2Body({ stage3Selection: 0 }));

    expect(res.status).toBe(200);
    expect(recordAnchorResponse.mock.calls[0][0].stage3Selection).toBe(0);
  });

  it("段階3'（新情報なしの反論）が無い項目では null で記録する", async () => {
    await post(v2Body({ stage3bSelection: undefined, stage3bDurationMs: undefined }));

    expect(recordAnchorResponse.mock.calls[0][0].stage3bSelection).toBeNull();
    expect(recordAnchorResponse.mock.calls[0][0].stage3bDurationMs).toBeNull();
  });

  it("類型C（段階2なし）では段階2の回答が無くても通し、所要時間も null を維持する (RV-A6)", async () => {
    const res = await post(v2Body({ stage2Selection: undefined, stage2DurationMs: undefined }));

    expect(res.status).toBe(200);
    expect(recordAnchorResponse.mock.calls[0][0].stage2Selection).toBeNull();
    expect(recordAnchorResponse.mock.calls[0][0].stage2DurationMs).toBeNull();
  });

  it("解答所要時間が 0ms の場合は 0 を保持する（null と 0ms 即答を弁別する）", async () => {
    const res = await post(v2Body({ stage1DurationMs: 0 }));

    expect(res.status).toBe(200);
    expect(recordAnchorResponse.mock.calls[0][0].stage1DurationMs).toBe(0);
  });

  it("段階1が無ければ 400 で弾く", async () => {
    const res = await post(v2Body({ stage1Selection: undefined }));

    expect(res.status).toBe(400);
    expect(recordAnchorResponse).not.toHaveBeenCalled();
  });

  it("段階3が無ければ 400 で弾く", async () => {
    const res = await post(v2Body({ stage3Selection: undefined }));

    expect(res.status).toBe(400);
    expect(recordAnchorResponse).not.toHaveBeenCalled();
  });

  it("anchor_items に無い項目IDは 409 で、投入手順を案内する", async () => {
    anchorItemFindUnique.mockResolvedValue(null);

    const res = await post(v2Body());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("seed:anchors");
    expect(recordAnchorResponse).not.toHaveBeenCalled();
  });

  it("応答時点の anchor_status は DB 側の値を使う（クライアントの申告を使わない）", async () => {
    anchorItemFindUnique.mockResolvedValue({ anchor_status: "operational" });

    await post(v2Body({ anchorStatus: "retired" }));

    expect(recordAnchorResponse.mock.calls[0][0].anchorStatus).toBe("operational");
  });

  it("同じ項目への二重回答は 409 で返し、1回目の応答を上書きしない", async () => {
    // 1回目こそが「初見で気づいたか」の測定値である。サーバ障害ではないので 500 にしない。
    recordAnchorResponse.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed on the fields: (`session_id`,`anchor_id`)"), {
        code: "P2002",
      })
    );

    const res = await post(v2Body());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.alreadyAnswered).toBe(true);
    // Prisma の例外文（テーブル名・カラム名）をそのまま外へ出さない
    expect(json.error).not.toContain("session_id");
  });

  it("一意制約以外の DB エラーは 409 に丸めず 500 のまま返す", async () => {
    recordAnchorResponse.mockRejectedValue(
      Object.assign(new Error("connection refused"), { code: "P1001" })
    );

    const res = await post(v2Body());

    expect(res.status).toBe(500);
  });

  it("未知のセッションでは記録しない", async () => {
    resolveSessionContext.mockRejectedValue(new Error("Unknown session_id: session-x"));

    const res = await post(v2Body());

    expect(res.status).toBe(500);
    expect(recordAnchorResponse).not.toHaveBeenCalled();
  });
});
