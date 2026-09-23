import { describe, expect, it } from "vitest";
import {
  PREMISE_SHIFT_DEFAULT_TRIGGER_USER_TURNS,
  buildPremiseShiftNotification,
  decidePremiseShift,
} from "./index";
import { DYNAMIC_TASKS } from "@/data/dynamic-task";

describe("decidePremiseShift", () => {
  const base = { hasPremiseShift: true, alreadyInjected: false, userTurnCount: 2 };

  it("injects once the learner has spoken the threshold number of times", () => {
    expect(decidePremiseShift(base)).toEqual({ inject: true });
  });

  it("does not inject before the threshold", () => {
    expect(decidePremiseShift({ ...base, userTurnCount: 1 })).toEqual({
      inject: false,
      reason: "trigger_turn_not_reached",
    });
  });

  it("does not inject twice in one session", () => {
    expect(decidePremiseShift({ ...base, alreadyInjected: true })).toEqual({
      inject: false,
      reason: "already_injected",
    });
  });

  it("does not inject for tasks without a premise shift", () => {
    expect(decidePremiseShift({ ...base, hasPremiseShift: false })).toEqual({
      inject: false,
      reason: "no_premise_shift_defined",
    });
  });

  it("honours a per-task threshold", () => {
    expect(decidePremiseShift({ ...base, userTurnCount: 2, triggerAfterUserTurns: 3 })).toEqual({
      inject: false,
      reason: "trigger_turn_not_reached",
    });
    expect(decidePremiseShift({ ...base, userTurnCount: 3, triggerAfterUserTurns: 3 })).toEqual({
      inject: true,
    });
  });

  /**
   * 受講者の操作は判定の入力に現れない。入力は「課題定義・注入済みか・発話回数」だけで、
   * 同じ発話回数なら誰でも同じターンで撃たれる。この性質が崩れたら注入時点が
   * 比較不能な自由度になる `[D-100]`。
   */
  it("is a pure function of the logged state (same input, same decision)", () => {
    const input = { ...base, userTurnCount: 5 };
    expect(decidePremiseShift(input)).toEqual(decidePremiseShift(input));
  });
});

describe("premise shift task definitions", () => {
  it("every task that defines a premise shift also defines its trigger point", () => {
    for (const task of DYNAMIC_TASKS) {
      if (!task.premise_shift) continue;
      expect(task.premise_shift.trigger_after_user_turns ?? PREMISE_SHIFT_DEFAULT_TRIGGER_USER_TURNS)
        .toBeGreaterThanOrEqual(1);
    }
  });

  it("builds a notification that carries both the announcement and the new requirement", () => {
    const shift = DYNAMIC_TASKS.find((t) => t.premise_shift)?.premise_shift;
    expect(shift).toBeDefined();
    const text = buildPremiseShiftNotification(shift!);
    expect(text).toContain(shift!.announcement);
    expect(text).toContain(shift!.new_requirement);
  });
});
