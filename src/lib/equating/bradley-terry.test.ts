import { describe, expect, it } from "vitest";
import { fitBradleyTerry, type Comparison } from "./bradley-terry";
import { createRng } from "./random";
import { spearman } from "./simulation";

describe("fitBradleyTerry", () => {
  it("returns abilities centered at zero", () => {
    const comparisons: Comparison[] = [
      { winner: 0, loser: 1 },
      { winner: 1, loser: 2 },
      { winner: 0, loser: 2 },
      { winner: 2, loser: 0 },
    ];
    const { ability } = fitBradleyTerry(3, comparisons);
    const mean = ability.reduce((a, b) => a + b, 0) / ability.length;
    expect(mean).toBeCloseTo(0, 10);
  });

  it("orders players consistently with their win records", () => {
    const comparisons: Comparison[] = [
      { winner: 0, loser: 1 },
      { winner: 0, loser: 1 },
      { winner: 1, loser: 0 },
      { winner: 1, loser: 2 },
      { winner: 1, loser: 2 },
      { winner: 2, loser: 1 },
    ];
    const { ability } = fitBradleyTerry(3, comparisons);
    expect(ability[0]).toBeGreaterThan(ability[1]);
    expect(ability[1]).toBeGreaterThan(ability[2]);
  });

  it("stays finite when a player wins or loses every comparison", () => {
    const comparisons: Comparison[] = [
      { winner: 0, loser: 1 },
      { winner: 0, loser: 2 },
      { winner: 1, loser: 2 },
    ];
    const { ability, converged } = fitBradleyTerry(3, comparisons);
    expect(converged).toBe(true);
    for (const a of ability) expect(Number.isFinite(a)).toBe(true);
  });

  it("recovers known strengths from sufficient comparisons", () => {
    const rng = createRng(7);
    const n = 40;
    const truth = Array.from({ length: n }, () => rng.normal());
    const comparisons: Comparison[] = [];
    for (let rep = 0; rep < 30; rep++) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1 + Math.floor(rng.next() * (n - 1))) % n;
        const p = 1 / (1 + Math.exp(-(truth[i] - truth[j])));
        comparisons.push(rng.next() < p ? { winner: i, loser: j } : { winner: j, loser: i });
      }
    }
    const { ability } = fitBradleyTerry(n, comparisons);
    expect(spearman(truth, ability)).toBeGreaterThan(0.9);
  });
});

describe("createRng", () => {
  it("is reproducible for the same seed", () => {
    const a = createRng(123);
    const b = createRng(123);
    const xs = Array.from({ length: 5 }, () => a.next());
    const ys = Array.from({ length: 5 }, () => b.next());
    expect(xs).toEqual(ys);
  });

  it("draws standard normals with mean near 0 and sd near 1", () => {
    const rng = createRng(1);
    const xs = Array.from({ length: 20000 }, () => rng.normal());
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
    expect(mean).toBeCloseTo(0, 1);
    expect(sd).toBeCloseTo(1, 1);
  });
});

describe("spearman", () => {
  it("is 1 for identical orderings and handles ties", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
    expect(Number.isFinite(spearman([1, 2, 3, 4], [1, 1, 2, 2]))).toBe(true);
  });
});
