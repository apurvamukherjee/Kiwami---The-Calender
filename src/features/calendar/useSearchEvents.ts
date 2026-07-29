import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import { db } from "../../db/db";
import { expandOccurrences } from "../../lib/recurrence";
import { todayKey } from "../../lib/date.utils";
import type { EventDto } from "../../db/types";

const SEARCH_WINDOW_DAYS = 180;
const MAX_RESULTS = 20;

export interface SearchResult {
  event: EventDto;
  date: string; // nearest occurrence date — upcoming if one exists within the window, else the most recent past one
}

// Title-substring match over every event (not just the currently visible
// calendar range), resolving each match's nearest occurrence via the same
// expandOccurrences used everywhere else. Shared by the toolbar search icon
// and the Command Palette — one hook, two entry points.
export function useSearchEvents(query: string): SearchResult[] {
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.recurrenceRules.toArray(), []) ?? [];
  const rulesByEvent = useMemo(() => new Map(rules.map((r) => [r.eventId, r])), [rules]);

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const today = todayKey();
    const windowStart = dayjs(today).subtract(SEARCH_WINDOW_DAYS, "day").format("YYYY-MM-DD");
    const windowEnd = dayjs(today).add(SEARCH_WINDOW_DAYS, "day").format("YYYY-MM-DD");

    const results: SearchResult[] = [];
    for (const event of events) {
      if (!event.title.toLowerCase().includes(q)) continue;
      const rule = event.id != null ? rulesByEvent.get(event.id) : undefined;
      const anchorDate = event.startTime.slice(0, 10);

      if (rule) {
        const dates = expandOccurrences(anchorDate, rule, windowStart, windowEnd);
        if (dates.length === 0) continue;
        const upcoming = dates.find((d) => d >= today);
        results.push({ event, date: upcoming ?? dates[dates.length - 1] });
      } else {
        results.push({ event, date: anchorDate });
      }
    }

    return results
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, MAX_RESULTS);
  }, [events, rulesByEvent, query]);
}
