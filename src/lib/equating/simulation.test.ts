import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPERIMENT1,
  DEFAULT_EXPERIMENT2,
  runExperiment1,
  runExperiment2,
} from "./simulation";

// 反復回数は少なめにしている。ここで固定するのは向きと大小関係であって、正確な値ではない
const REPS = 40;

describe("experiment 1: task difficulty confound", () => {
  it("pairwise + Bradley-Terry recovers ability better than absolute scoring when the judge removes difficulty", () => {
    const r = runExperiment1({ ...DEFAULT_EXPERIMENT1, lambda: 0 }, REPS, 11);
    expect(r.pairwise.mean).toBeGreaterThan(r.absolute.mean + 0.2);
  });

  it("loses most of its advantage when the judge keeps the full difficulty confound", () => {
    const clean = runExperiment1({ ...DEFAULT_EXPERIMENT1, lambda: 0 }, REPS, 12);
    const confounded = runExperiment1({ ...DEFAULT_EXPERIMENT1, lambda: 1 }, REPS, 12);
    expect(confounded.pairwise.mean).toBeLessThan(clean.pairwise.mean - 0.15);
  });

  it("is reproducible for the same seed", () => {
    const a = runExperiment1(DEFAULT_EXPERIMENT1, 5, 3);
    const b = runExperiment1(DEFAULT_EXPERIMENT1, 5, 3);
    expect(a).toEqual(b);
  });
});

describe("experiment 2: separating ability change from judge drift", () => {
  it("layer 1 and the fixed items agree when only ability changes", () => {
    const r = runExperiment2("ability_gain", DEFAULT_EXPERIMENT2, REPS, 21);
    expect(r.anchorGain.mean).toBeGreaterThan(0.25);
    expect(Math.abs(r.gainDiscrepancy.mean)).toBeLessThan(0.15);
    expect(r.controlStylePreference.mean).toBeGreaterThan(0.35);
    expect(r.controlStylePreference.mean).toBeLessThan(0.65);
  });

  it("layer 1 shows a spurious gain that the fixed items do not, when only the judge drifts", () => {
    const r = runExperiment2("judge_drift", DEFAULT_EXPERIMENT2, REPS, 22);
    expect(Math.abs(r.anchorGain.mean)).toBeLessThan(0.15);
    expect(r.gainDiscrepancy.mean).toBeGreaterThan(0.25);
    expect(r.controlStylePreference.mean).toBeGreaterThan(0.75);
  });

  it("reports both signals when ability and judge change together", () => {
    const r = runExperiment2("both", DEFAULT_EXPERIMENT2, REPS, 23);
    expect(r.anchorGain.mean).toBeGreaterThan(0.25);
    expect(r.gainDiscrepancy.mean).toBeGreaterThan(0.25);
    expect(r.controlStylePreference.mean).toBeGreaterThan(0.75);
  });
});
