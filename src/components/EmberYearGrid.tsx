import { useMemo } from "react";
import dayjs from "dayjs";
import { useTokens } from "../hooks/useTokens";
import { todayKey } from "../lib/date.utils";
import type { OccurrenceStatusValue } from "../db/types";

interface EmberYearGridProps {
  year: number;
  occurrences: Map<string, OccurrenceStatusValue>;
}

const CELL = 11;
const GAP = 3;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// GitHub-contributions-style grid (weeks as columns, weekdays as rows) but
// colored with the Ember Chain's exact palette instead of green squares —
// lit amber glow = done, cold ash = missed, dim = no data that day.
export function EmberYearGrid({ year, occurrences }: EmberYearGridProps) {
  const tokens = useTokens();
  const today = todayKey();

  const { weeks, monthMarkers } = useMemo(() => {
    const start = dayjs(`${year}-01-01`);
    const end = dayjs(`${year}-12-31`);
    const startWeekday = start.day(); // 0 = Sun
    const totalDays = end.diff(start, "day") + 1;
    const weekCount = Math.ceil((startWeekday + totalDays) / 7);

    const weeks: (string | null)[][] = Array.from({ length: weekCount }, () => Array(7).fill(null));
    for (let d = 0; d < totalDays; d++) {
      const cellIndex = startWeekday + d;
      weeks[Math.floor(cellIndex / 7)][cellIndex % 7] = start.add(d, "day").format("YYYY-MM-DD");
    }

    const monthMarkers: { week: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const firstOfWeek = weeks[w].find((c) => c != null);
      if (!firstOfWeek) continue;
      const m = dayjs(firstOfWeek).month();
      if (m !== lastMonth) {
        monthMarkers.push({ week: w, label: MONTH_LABELS[m] });
        lastMonth = m;
      }
    }
    return { weeks, monthMarkers };
  }, [year]);

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ position: "relative", height: 16, minWidth: weeks.length * (CELL + GAP) }}>
        {monthMarkers.map((m, i) => (
          <span key={i} style={{
            position: "absolute", left: m.week * (CELL + GAP), fontSize: 10,
            color: "var(--ink-soft)", fontWeight: 600,
          }}>
            {m.label}
          </span>
        ))}
      </div>
      <div style={{
        display: "grid", gridAutoFlow: "column", gridTemplateRows: `repeat(7, ${CELL}px)`,
        gap: GAP, width: "fit-content",
      }}>
        {weeks.flatMap((week, wi) => week.map((date, di) => {
          if (!date) return <div key={`${wi}-${di}`} style={{ width: CELL, height: CELL }} />;
          const status = occurrences.get(date);
          const isFuture = date > today;
          let background = "var(--border)";
          let boxShadow: string | undefined;
          let opacity = 0.35;
          if (status === "done") {
            background = tokens.emberHot;
            boxShadow = `0 0 3px ${tokens.accent}`;
            opacity = 1;
          } else if (status === "missed") {
            background = tokens.ash;
            opacity = 0.8;
          } else if (isFuture) {
            opacity = 0.12;
          }
          return (
            <div key={`${wi}-${di}`} title={`${date}${status ? ` · ${status}` : ""}`}
              style={{ width: CELL, height: CELL, borderRadius: 2, background, opacity, boxShadow }}
            />
          );
        }))}
      </div>
    </div>
  );
}
