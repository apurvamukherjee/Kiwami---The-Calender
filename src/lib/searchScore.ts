// Dependency-free text matcher for search (Command Palette's event/task/note
// results). No fuzzy-search library added — matches this codebase's
// build-the-small-thing-yourself discipline (chrono-node for dates, a
// hand-built bar chart in WeeklyReviewSheet, a hand-built heatmap in
// EmberYearGrid). Returns null on no match; higher score = better match, so
// callers can filter + sort in one pass.
//
// Score bands, highest to lowest: exact match, prefix match, plain substring,
// all query words present as substrings regardless of order (handles
// "sam meeting" matching "Meeting with Sam"), and finally a VS-Code-Cmd+P-
// style subsequence match as light typo tolerance for a single mistyped
// word. The subsequence fallback is gated behind a minimum query length —
// applied to short queries against freeform prose it produces mostly noise
// (nearly everything is a subsequence of a 1-2 character string).
const MIN_SUBSEQUENCE_QUERY_LEN = 3;

export function scoreMatch(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const t = text.toLowerCase();

  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((tok) => t.includes(tok))) return 50;

  if (q.length >= MIN_SUBSEQUENCE_QUERY_LEN) {
    const subsequenceScore = scoreSubsequence(q, t);
    if (subsequenceScore != null) return subsequenceScore;
  }

  return null;
}

// Every character of `q` appears in `t` in order (not necessarily
// contiguous) — null if not. Tighter (smaller span relative to query length)
// and earlier matches score higher, in the 1–30 range, always below every
// band above.
function scoreSubsequence(q: string, t: string): number | null {
  let cursor = 0;
  let firstMatch = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], cursor);
    if (idx === -1) return null;
    if (firstMatch === -1) firstMatch = idx;
    cursor = idx + 1;
  }
  const span = cursor - firstMatch;
  const density = q.length / span; // (0, 1] — 1 means the match was contiguous
  const positionBonus = 1 / (firstMatch + 1); // (0, 1] — earlier match, higher bonus
  return Math.round(10 + density * 15 + positionBonus * 5);
}
