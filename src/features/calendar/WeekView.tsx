import { useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { useTokens } from "../../hooks/useTokens";
import {
  HOUR_H, START_HOUR, TOTAL_H, HourGridLines, NowIndicator,
  TimeBlock, TimeGridColumn, isToday, layoutDayItems, eventColor,
} from "./timeGrid";
import type { CalendarItem } from "./useCalendarEvents";

const GUTTER = 52;

interface Props {
  rangeStart: string; // Sunday of the visible week
  items: CalendarItem[];
  onTapItem: (item: CalendarItem) => void;
  onCreateAt: (date: string, time: string, endTime: string) => void;
  onSelectDay: (date: string) => void;
}

// 7-day hour grid filling the full available width (proportional columns,
// not a fixed narrow pixel width) — this is a desktop-optimized calendar
// surface, not a mobile card scaled up. Header + all-day strip stay fixed
// above a vertically-scrolling hour grid.
export function WeekView({ rangeStart, items, onTapItem, onCreateAt, onSelectDay }: Props) {
  const tokens = useTokens();
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayjs(rangeStart).add(i, "day").format("YYYY-MM-DD")),
    [rangeStart],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const d of dates) m.set(d, []);
    for (const it of items) {
      if (it.event.allDay) continue;
      m.get(it.date)?.push(it);
    }
    return m;
  }, [items, dates]);

  const allDayByDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const d of dates) m.set(d, []);
    for (const it of items) {
      if (!it.event.allDay) continue;
      m.get(it.date)?.push(it);
    }
    return m;
  }, [items, dates]);

  const hasAllDay = dates.some((d) => (allDayByDate.get(d) ?? []).length > 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const h = new Date().getHours();
    scrollRef.current.scrollTop = Math.max(0, (h - START_HOUR - 1) * HOUR_H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)`, borderBottom: "1px solid var(--border)" }}>
        <div />
        {dates.map((d) => {
          const today = isToday(d);
          return (
            <button key={d} onClick={() => onSelectDay(d)} style={{
              background: "transparent", border: "none", cursor: "pointer", padding: "8px 0 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 700, textTransform: "uppercase" }}>{dayjs(d).format("ddd")}</div>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: "50%", margin: "3px auto 0",
                fontSize: 13, fontWeight: 800,
                background: today ? "var(--accent)" : "transparent",
                color: today ? "#fff" : "var(--ink)",
              }}>
                {dayjs(d).format("D")}
              </div>
            </button>
          );
        })}
      </div>

      {hasAllDay && (
        <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)`, borderBottom: "1px solid var(--border)", padding: "3px 0" }}>
          <div />
          {dates.map((d) => (
            <div key={d} style={{ padding: "0 3px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              {(allDayByDate.get(d) ?? []).map((it, i) => {
                const color = eventColor(it.event, tokens);
                return (
                  <button key={i} onClick={() => onTapItem(it)} style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 4, border: "none", cursor: "pointer",
                    background: `${color}28`, color, textAlign: "left",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {it.event.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ position: "relative", height: TOTAL_H, display: "grid", gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)` }}>
          <div style={{ position: "relative" }}>
            <HourGridLines />
          </div>
          {dates.map((d) => {
            const dayItems = byDate.get(d) ?? [];
            const layout = layoutDayItems(dayItems);
            return (
              <TimeGridColumn key={d} date={d} onCreateAt={onCreateAt} onEmptyTap={() => onSelectDay(d)}
                style={{ height: TOTAL_H, borderLeft: "1px solid var(--border)" }}>
                <NowIndicator date={d} left={2} right={2} />
                {dayItems.map((it, i) => {
                  const pos = layout.get(it) ?? { col: 0, cols: 1 };
                  return (
                    <TimeBlock key={`${it.event.id}-${i}`} item={it} onTap={onTapItem}
                      insetLeft={2} insetRight={2} compact col={pos.col} cols={pos.cols} />
                  );
                })}
              </TimeGridColumn>
            );
          })}
        </div>
      </div>
    </div>
  );
}
