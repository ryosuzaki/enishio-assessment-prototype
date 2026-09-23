import { describe, expect, it } from "vitest";
import { aggregateCredit, scoreAnchorResponse } from "./anchor-scoring";
import type { AnchorPanel, AnchorRecordV2 } from "./anchor-bank";

const panel = (status: AnchorPanel["status"]): AnchorPanel => ({
  status,
  n: 15,
  distribution: { "-2": 6, "-1": 7, "0": 2, "1": 0, "2": 0 },
});

function item(overrides: Partial<AnchorRecordV2> = {}): AnchorRecordV2 {
  return {
    anchor_id: "T-1",
    format_version: "v2-sct",
    family: "A",
    item_kind: "seeded_premise",
    title: "t",
    intro: "i",
    proposal: "p",
    hidden_premise: "h",
    stage1: { question: "q", options: [], correct_key: "2" },
    stage2: null,
    stage3: { new_information: "n", question: "q", scale: [], panel: panel("final") },
    stage3b: null,
    ...overrides,
  };
}

describe("aggregateCredit", () => {
  it("gives full credit to the modal option and proportional credit to others", () => {
    const d = panel("final").distribution;
    expect(aggregateCredit(d, -1)).toBe(1);
    expect(aggregateCredit(d, -2)).toBeCloseTo(6 / 7, 10);
    expect(aggregateCredit(d, 0)).toBeCloseTo(2 / 7, 10);
    expect(aggregateCredit(d, 2)).toBe(0);
  });

  it("gives zero for an option absent from the distribution", () => {
    expect(aggregateCredit({ "0": 3 }, 1)).toBe(0);
  });

  it("throws on an empty panel instead of dividing by zero", () => {
    expect(() => aggregateCredit({ "0": 0, "1": 0 }, 0)).toThrow();
  });
});

describe("scoreAnchorResponse", () => {
  it("scores stage 1 by the correct key", () => {
    expect(scoreAnchorResponse(item(), { stage1: "2", stage3: -1 }).stage1).toBe(1);
    expect(scoreAnchorResponse(item(), { stage1: "1", stage3: -1 }).stage1).toBe(0);
  });

  it("scores stage 3 with the panel when the panel is not mock", () => {
    const r = scoreAnchorResponse(item(), { stage1: "2", stage3: -2 });
    expect(r.stage3).toEqual({ status: "scored", credit: 6 / 7 });
  });

  it("does not score stage 3 while the panel is mock [D-82]", () => {
    const r = scoreAnchorResponse(
      item({ stage3: { new_information: "n", question: "q", scale: [], panel: panel("mock") } }),
      { stage1: "2", stage3: -1 },
    );
    expect(r.stage3).toEqual({ status: "not_scored", reason: "panel_mock" });
  });

  it("returns the stage 3' delta even when the panel is mock, because it needs no panel [D-83]", () => {
    const r = scoreAnchorResponse(
      item({
        stage3: { new_information: "n", question: "q", scale: [], panel: panel("mock") },
        stage3b: { pushback: "p", question: "q" },
      }),
      { stage1: "2", stage3: -2, stage3b: 0 },
    );
    expect(r.stage3bDelta).toBe(2);
  });

  it("leaves the stage 3' delta null when the item has no stage 3'", () => {
    expect(scoreAnchorResponse(item(), { stage1: "2", stage3: -1, stage3b: 0 }).stage3bDelta).toBeNull();
  });

  it("is deterministic", () => {
    const a = scoreAnchorResponse(item(), { stage1: "2", stage3: 0 });
    const b = scoreAnchorResponse(item(), { stage1: "2", stage3: 0 });
    expect(a).toEqual(b);
  });
});
