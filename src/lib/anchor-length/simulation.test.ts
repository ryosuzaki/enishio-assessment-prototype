import { describe, expect, it } from "vitest";
import { createRng } from "../equating/random";
import {
  calibrateLoading,
  cronbachAlpha,
  generateAnchorScores,
  perItemReliability,
  runAnchorLength,
  spearmanBrown,
  spearmanCi,
} from "./simulation";

describe("reliability helpers", () => {
  it("Spearman-Brown and its inverse round-trip", () => {
    expect(perItemReliability(spearmanBrown(0.06, 20), 20)).toBeCloseTo(0.06, 10);
  });

  it("Fisher-z interval contains the estimate and narrows with n", () => {
    const small = spearmanCi(0.6, 30);
    const large = spearmanCi(0.6, 300);
    expect(small.lower).toBeLessThan(0.6);
    expect(small.upper).toBeGreaterThan(0.6);
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
  });
});

describe("anchor score generation", () => {
  it("calibrated loading reproduces the target per-item reliability", () => {
    const loading = calibrateLoading(0.1, 7, 8000);
    const rng = createRng(99);
    const theta = Array.from({ length: 8000 }, () => rng.normal());
    const alpha = cronbachAlpha(generateAnchorScores(rng, theta, 30, loading));
    expect(perItemReliability(alpha, 30)).toBeCloseTo(0.1, 1);
  });
});

// 反復回数は少なめにしている。ここで固定するのは向きと大小関係であって、正確な値ではない
const REPS = 60;

describe("convergent validity pass rate", () => {
  const base = { learners: 60, trueCorrelation: 0.9, cjReliability: 0.8 };

  it("rises with the number of items", () => {
    const loading = calibrateLoading(0.06, 3, 5000);
    const short = runAnchorLength({ ...base, length: 10, loading }, REPS, 5);
    const long = runAnchorLength({ ...base, length: 60, loading }, REPS, 5);
    expect(long.rho.mean).toBeGreaterThan(short.rho.mean + 0.1);
    expect(long.passRate).toBeGreaterThan(short.passRate);
  });

  it("disattenuation recovers roughly the true correlation", () => {
    const loading = calibrateLoading(0.1, 3, 5000);
    const r = runAnchorLength({ ...base, length: 30, loading }, REPS, 6);
    expect(Math.abs(r.disattenuated.median - base.trueCorrelation)).toBeLessThan(0.12);
  });

  it("is reproducible for the same seed", () => {
    const params = { ...base, length: 15, loading: 0.4 };
    expect(runAnchorLength(params, 5, 8)).toEqual(runAnchorLength(params, 5, 8));
  });
});
