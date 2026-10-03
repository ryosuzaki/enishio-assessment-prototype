import { describe, expect, it } from "vitest";
import { fitBradleyTerry, type Comparison } from "./bradley-terry";

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

  // Deterministic input on purpose: each pair's win counts are set to the expected counts
  // under known strengths, so the test checks the MM algorithm, not a simulated judge.
  it("recovers known log-strengths from a round robin with expected win counts", () => {
    const truth = [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5];
    const gamesPerPair = 40;
    const comparisons: Comparison[] = [];
    for (let i = 0; i < truth.length; i++) {
      for (let j = i + 1; j < truth.length; j++) {
        const p = 1 / (1 + Math.exp(-(truth[i] - truth[j])));
        const winsI = Math.round(gamesPerPair * p);
        for (let k = 0; k < winsI; k++) comparisons.push({ winner: i, loser: j });
        for (let k = winsI; k < gamesPerPair; k++) comparisons.push({ winner: j, loser: i });
      }
    }
    const { ability, converged } = fitBradleyTerry(truth.length, comparisons);
    expect(converged).toBe(true);
    for (let i = 1; i < truth.length; i++) expect(ability[i]).toBeGreaterThan(ability[i - 1]);
    // The weak prior (one virtual win and loss per player) shrinks estimates slightly toward 0.
    for (let i = 0; i < truth.length; i++) expect(Math.abs(ability[i] - truth[i])).toBeLessThan(0.15);
  });
});
