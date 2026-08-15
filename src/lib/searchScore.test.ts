import { describe, it, expect } from "vitest";
import { scoreMatch } from "./searchScore";

describe("scoreMatch", () => {
  it("returns null for an empty query", () => {
    expect(scoreMatch("", "Morning meditation")).toBeNull();
    expect(scoreMatch("   ", "Morning meditation")).toBeNull();
  });

  it("returns null when there is no match at all", () => {
    expect(scoreMatch("zzz", "Morning meditation")).toBeNull();
  });

  it("scores an exact match highest", () => {
    const exact = scoreMatch("morning meditation", "Morning meditation")!;
    const prefix = scoreMatch("morning", "Morning meditation")!;
    expect(exact).toBeGreaterThan(prefix);
  });

  it("scores a prefix match above a mid-string substring match", () => {
    const prefix = scoreMatch("morning", "Morning meditation")!;
    const midString = scoreMatch("medit", "Morning meditation")!;
    expect(prefix).toBeGreaterThan(midString);
  });

  it("matches all query words regardless of order", () => {
    const score = scoreMatch("sam meeting", "Meeting with Sam");
    expect(score).not.toBeNull();
  });

  it("ranks a contiguous substring above an out-of-order multi-word match", () => {
    const contiguous = scoreMatch("meeting with", "Meeting with Sam")!;
    const outOfOrder = scoreMatch("sam meeting", "Meeting with Sam")!;
    expect(contiguous).toBeGreaterThan(outOfOrder);
  });

  it("falls back to a subsequence match for light typo tolerance", () => {
    // "gorcery" isn't a substring of "Grocery run", but every character of
    // "gry" (a plausible fat-fingered fragment) does appear in order.
    expect(scoreMatch("gry", "Grocery run")).not.toBeNull();
  });

  it("does not apply the subsequence fallback below the minimum query length", () => {
    // "gy" is a genuine non-contiguous subsequence of "Grocery run" (the 'g'
    // of "Grocery" followed later by the 'y') and not a literal substring —
    // it would match via the fallback, but at only 2 characters it should be
    // gated off entirely to avoid near-universal noise on short queries.
    expect(scoreMatch("gy", "Grocery run")).toBeNull();
  });

  it("ranks every real match band below an exact/prefix/substring match", () => {
    const substring = scoreMatch("groc", "Grocery run")!;
    const subsequence = scoreMatch("gry", "Grocery run")!;
    expect(substring).toBeGreaterThan(subsequence);
  });
});
