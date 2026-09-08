import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { shuffleOptions, isV2, isRetiredSource, type AnchorRecordV2 } from "./anchor-bank";

/**
 * v1 運用バンク（20項目）は、**両設問とも正答が全項目でキー A に固定**されており、
 * かつ提示時のシャッフルも無かった。「A, A」と答えれば読まずに満点であり、
 * 能力とは無関係に解けていた（`[D-83]` で退役）。
 *
 * ここで守るのは次の3点である。項目を足すたびに人手で確認できるものではないため、
 * バンクそのものを検査する。
 *
 * 1. 正答キーが全項目で同一にならないこと
 * 2. 類型C（仕込んだ不備が無い項目）が混ざっていること
 * 3. パネルがダミー（mock）である間は、それが明示されていること
 */
const V2_SAMPLE = path.resolve(process.cwd(), "src/data/anchors.v2.sample.json");

function loadV2Sample(): AnchorRecordV2[] {
  return JSON.parse(fs.readFileSync(V2_SAMPLE, "utf-8")) as AnchorRecordV2[];
}

describe("shuffleOptions", () => {
  it("要素を落とさず、提示順を記録できる形で返す", () => {
    const options = [
      { key: "A", text: "a" },
      { key: "B", text: "b" },
      { key: "C", text: "c" },
      { key: "D", text: "d" },
    ];
    const { options: shuffled, order } = shuffleOptions(options);
    expect(shuffled).toHaveLength(4);
    expect([...shuffled].map((o) => o.key).sort()).toEqual(["A", "B", "C", "D"]);
    // order は「実際に画面へ出した順」でなければ、後から応答を解釈できない
    expect(order).toBe(shuffled.map((o) => o.key).join(","));
  });

  it("入力配列を破壊しない", () => {
    const options = [
      { key: "A", text: "a" },
      { key: "B", text: "b" },
    ];
    shuffleOptions(options, () => 0);
    expect(options.map((o) => o.key)).toEqual(["A", "B"]);
  });

  it("十分な試行で複数の並びが現れる（提示順が固定されていない）", () => {
    const options = [
      { key: "A", text: "a" },
      { key: "B", text: "b" },
      { key: "C", text: "c" },
      { key: "D", text: "d" },
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(shuffleOptions(options).order);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("v2 アンカーバンク（同梱サンプル）", () => {
  const bank = loadV2Sample();

  it("すべて v2-sct として読める", () => {
    expect(bank.length).toBeGreaterThanOrEqual(3);
    for (const item of bank) {
      expect(isV2(item)).toBe(true);
    }
  });

  it("段階1の正答キーが全項目で同一ではない（v1 の『全問A』の再発防止）", () => {
    const keys = new Set(bank.map((i) => i.stage1.correct_key));
    expect(keys.size).toBeGreaterThan(1);
  });

  it("段階2の正答キーが全項目で同一ではない", () => {
    const correct = bank
      .filter((i) => i.stage2)
      .map((i) => i.stage2!.options.find((o) => o.note === "正解")?.key);
    expect(correct.length).toBeGreaterThan(0);
    for (const k of correct) expect(k).toBeDefined();
    // 段階2を持つ項目が1本しかない場合はこの検査が成立しないため、そのときは
    // 「A に固定されていない」ことだけを見る。
    if (correct.length > 1) {
      expect(new Set(correct).size).toBeGreaterThan(1);
    } else {
      expect(correct[0]).not.toBe("A");
    }
  });

  it("類型C（仕込んだ不備が無い項目）が混ざっている", () => {
    const noDefect = bank.filter((i) => i.item_kind === "no_defect");
    expect(noDefect.length).toBeGreaterThan(0);
    for (const item of noDefect) {
      // 不備が無いのだから、正答は「そのまま採用してよい」である
      expect(item.stage1.correct_key).toBe("1");
      expect(item.hidden_premise).toBeNull();
      // 懸念領域を問うこと自体が「不備がある」というヒントになるため出題しない
      expect(item.stage2).toBeNull();
    }
  });

  it("「常に条件付きを選ぶ」戦略が全項目では通らない", () => {
    const alwaysConditional = bank.every((i) => i.stage1.correct_key === "2");
    expect(alwaysConditional).toBe(false);
  });

  it("段階3は前提変化の新情報とリッカート尺度を持つ", () => {
    for (const item of bank) {
      expect(item.stage3.new_information.length).toBeGreaterThan(0);
      expect(item.stage3.scale.map((s) => s.value)).toEqual([-2, -1, 0, 1, 2]);
    }
  });

  it("段階3'（新情報を含まない反論）が一部の項目にだけ付いている", () => {
    const withPushback = bank.filter((i) => i.stage3b);
    // 1本も無ければ「押し返す」が測れない
    expect(withPushback.length).toBeGreaterThan(0);
    // 全項目に付いていると「2回目は動かない」を学習され、測れなくなる（露出による劣化）
    expect(withPushback.length).toBeLessThan(bank.length);
  });

  it("段階3' はパネル不要の差分採点として定義されている", () => {
    for (const item of bank) {
      if (!item.stage3b) continue;
      expect(item.stage3b.pushback.length).toBeGreaterThan(0);
      expect(item.stage3b.question.length).toBeGreaterThan(0);
      // 「新情報を含まない」という設計意図は自動検査できない。記録の有無だけを担保する
      expect(item.stage3b.note ?? "").not.toBe("");
      const scoring = item.stage3b.scoring as Record<string, unknown> | undefined;
      expect(scoring?.panel_required).toBe(false);
      expect(scoring?.formula).toBe("stage3b_selection - stage3_selection");
    }
  });

  it("パネルがダミーである間はその旨が記録されている", () => {
    for (const item of bank) {
      const panel = item.stage3.panel;
      const total = Object.values(panel.distribution).reduce((a, b) => a + b, 0);
      expect(total).toBe(panel.n);
      if (panel.status === "mock") {
        // 実在しない基準を実在するように見せないため、注記を必須にする
        expect(panel.note ?? "").not.toBe("");
      }
    }
  });
});

describe("isRetiredSource", () => {
  it("v1 の供給源だけを退役として扱う", () => {
    expect(isRetiredSource("operational_v1_retired")).toBe(true);
    expect(isRetiredSource("demo_sample_v1_retired")).toBe(true);
    expect(isRetiredSource("operational_v2")).toBe(false);
    expect(isRetiredSource("demo_sample_v2")).toBe(false);
    expect(isRetiredSource("missing")).toBe(false);
  });
});
