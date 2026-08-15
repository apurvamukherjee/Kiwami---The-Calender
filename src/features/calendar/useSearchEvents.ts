import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import { db } from "../../db/db";
import { expandOccurrences } from "../../lib/recurrence";
import { todayKey } from "../../lib/date.utils";
import { scoreMatch } from "../../lib/searchScore";
import type { EventDto } from "../../db/types";

const SEARCH_WINDOW_DAYS = 180;
const MAX_RESULTS = 20;

export interface SearchResult {
  event: EventDto;
  date: string; // nearest occurrence date — upcoming if one exists within the window, else the most recent past one
}

interface ScoredResult extends SearchResult {
  score: number;
}

// Best score across title/location/description, or null if none match.
function scoreEvent(query: string, event: EventDto): number | null {
  let best: number | null = null;
  for (const text of [event.title, event.location, event.description]) {
    if (!text) continue;
    const s = scoreMatch(query, text);
    if (s != null && (best == null || s > best)) best = s;
  }
  return best;
}

// Fuzzy match (title, then location, then description — via scoreMatch) over
// every event (not just the currently visible calendar range), resolving
// each match's nearest occurrence via the same expandOccurrences used
// everywhere else. Shared by the toolbar search icon and the Command
// Palette — one hook, two entry points.
export function useSearchEvents(query: string): SearchResult[] {
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.recurrenceRules.toArray(), []) ?? [];
  const rulesByEvent = useMemo(() => new Map(rules.map((r) => [r.eventId, r])), [rules]);

  return useMemo(() => {
    if (!query.trim()) return [];

    const today = todayKey();
    const windowStart = dayjs(today).subtract(SEARCH_WINDOW_DAYS, "day").format("YYYY-MM-DD");
    const windowEnd = dayjs(today).add(SEARCH_WINDOW_DAYS, "day").format("YYYY-MM-DD");

    const results: ScoredResult[] = [];
    for (const event of events) {
      const score = scoreEvent(query, event);
      if (score == null) continue;
      const rule = event.id != null ? rulesByEvent.get(event.id) : undefined;
      const anchorDate = event.startTime.slice(0, 10);

      if (rule) {
        const dates = expandOccurrences(anchorDate, rule, windowStart, windowEnd);
        if (dates.length === 0) continue;
        const upcoming = dates.find((d) => d >= today);
        results.push({ event, date: upcoming ?? dates[dates.length - 1], score });
      } else {
        results.push({ event, date: anchorDate, score });
      }
    }

    // Rank by match quality first so a strong match can't be crowded out of
    // the MAX_RESULTS cap by weaker fuzzy matches that merely land on a
    // nearer date, then re-sort the surviving slice back to date order for
    // display (nearest-occurrence-first is still the more useful reading
    // order once the candidate set is already relevant).
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, rulesByEvent, query]);
}
