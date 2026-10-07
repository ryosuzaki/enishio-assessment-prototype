import { describe, expect, it } from "vitest";
import { buildPremiseShiftNotification } from "./index";
import { DYNAMIC_TASKS } from "@/data/dynamic-task";

describe("premise shift task definitions", () => {
  it("every task defines a premise shift (the review flow always presents one on submission)", () => {
    for (const task of DYNAMIC_TASKS) {
      expect(task.premise_shift, task.task_id).toBeDefined();
    }
  });

  it("builds a notification that carries both the announcement and the new requirement", () => {
    const shift = DYNAMIC_TASKS.find((t) => t.premise_shift)?.premise_shift;
    expect(shift).toBeDefined();
    const text = buildPremiseShiftNotification(shift!);
    expect(text).toContain(shift!.announcement);
    expect(text).toContain(shift!.new_requirement);
  });

  it("does not tell the learner what to do next (the shift is a notice, not a request)", () => {
    for (const task of DYNAMIC_TASKS) {
      if (!task.premise_shift) continue;
      const text = buildPremiseShiftNotification(task.premise_shift);
      // 次の行動を促すと、不意の変化に自分から方針を組み直すかどうかを測れなくなる
      expect(text).not.toContain("お願いします");
      expect(text.endsWith(`「${task.premise_shift.new_requirement}」`)).toBe(true);
    }
  });
});
