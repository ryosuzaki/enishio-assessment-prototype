import { describe, expect, it } from "vitest";
import { levenshtein } from "./edit-distance";

describe("levenshtein", () => {
  it("returns 0 for two empty strings", () => {
    expect(levenshtein("", "")).toBe(0);
  });

  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello world", "hello world")).toBe(0);
  });

  it("returns the length of b when a is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("returns the length of a when b is empty", () => {
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("counts a single insertion as distance 1", () => {
    expect(levenshtein("abc", "abcd")).toBe(1);
  });

  it("counts a single deletion as distance 1", () => {
    expect(levenshtein("abcd", "abc")).toBe(1);
  });

  it("counts a single substitution as distance 1", () => {
    expect(levenshtein("abc", "abd")).toBe(1);
  });

  it("is symmetric", () => {
    expect(levenshtein("kitten", "sitting")).toBe(levenshtein("sitting", "kitten"));
  });

  it("computes the classic kitten/sitting distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("handles completely different strings of equal length", () => {
    expect(levenshtein("abc", "xyz")).toBe(3);
  });

  it("handles Japanese strings with a single character edit", () => {
    expect(levenshtein("こんにちは", "こんばんは")).toBe(2);
  });

  it("handles Japanese strings that are identical", () => {
    expect(levenshtein("要件2に反する", "要件2に反する")).toBe(0);
  });

  it("handles a Japanese insertion", () => {
    expect(levenshtein("正常箇所", "正常な箇所")).toBe(1);
  });

  it("falls back to the length-difference shortcut for inputs beyond MAX_LEN", () => {
    // MAX_LEN is 20000 inside edit-distance.ts; strings longer than that use
    // Math.abs(a.length - b.length) instead of the full DP table.
    const a = "x".repeat(20001);
    const b = "x".repeat(20005);
    expect(levenshtein(a, b)).toBe(4);
  });
});
