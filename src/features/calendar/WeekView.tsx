import { useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { useTokens } from "../../hooks/useTokens";
import {
  HOUR_H, HourGridLines, NowIndicator, totalHeight, computeHourRange,
  TimeBlock, TimeGridColumn, isToday, layoutDayItems, eventColor, computeSpanColumns,
  NoteTaskBlock, layoutTimedNoteTasks, type TimedNoteTask,
} from "./timeGrid";
import { isSpanningItem } from "./useCalendarEvents";
import type { CalendarItem } from "./useCalendarEvents";
import type { NoteDto, TaskDto } from "../../db/types";

const GUTTER = 52;
const SPAN_BAR_H = 20;

interface Props {
  rangeStart: string; // Sunday of the visible week
  items: CalendarItem[];
  notes: NoteDto[];
  tasks: TaskDto[];
  onTapItem: (item: CalendarItem) => void;
  onTapNote: (note: NoteDto) => void;
  onTapTask: (task: TaskDto) => void;
  onCreateAt: (date: string, time: string, endTime: string) => void;
  onSelectDay: (date: string) => void;
}

// 7-day hour grid filling the full available width (proportional columns,
// not a fixed narrow pixel width) — this is a desktop-optimized calendar
// surface, not a mobile card scaled up. Header + all-day strip stay fixed
// above a vertically-scrolling hour grid.
export function WeekView({ rangeStart, items, notes, tasks, onTapItem, onTapNote, onTapTask, onCreateAt, onSelectDay }: Props) {
  const tokens = useTokens();
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayjs(rangeStart).add(i, "day").format("YYYY-MM-DD")),
    [rangeStart],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const d of dates) m.set(d, []);
    for (const it of items) {
      if (it.event.allDay || isSpanningItem(it)) continue;
      m.get(it.date)?.push(it);
    }
    return m;
  }, [items, dates]);

  // Multi-day events get their own continuous bar row (below) instead of a
  // per-day pill here — excluded so they don't also duplicate into every
  // day's own pill stack.
  const allDayByDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const d of dates) m.set(d, []);
    for (const it of items) {
      if (!it.event.allDay || isSpanningItem(it)) continue;
      m.get(it.date)?.push(it);
    }
    return m;
  }, [items, dates]);

  // Clip every spanning event to this visible week and stack overlapping
  // ones — same computeSpanColumns algorithm MonthView reuses for its own
  // week-row bars, just for a single week here so no per-row grouping is
  // needed. Placed via native CSS Grid column/row spanning (the all-day
  // strip is already a `${GUTTER}px repeat(7,1fr)` grid) rather than
  // percentage-based absolute positioning — simpler when there's only one
  // row to place into.
  const spanBars = useMemo(() => {
    const weekStart = dates[0];
    const weekEnd = dates[6];
    const bars: { key: string; item: CalendarItem; startCol: number; endCol: number }[] = [];
    for (const it of items) {
      if (!isSpanningItem(it)) continue;
      const clippedStart = it.date > weekStart ? it.date : weekStart;
      const clippedEnd = it.spanEndDate! < weekEnd ? it.spanEndDate! : weekEnd;
      if (clippedStart > clippedEnd) continue;
      bars.push({
        key: `${it.event.id}`, item: it,
        startCol: dayjs(clippedStart).diff(weekStart, "day"),
        endCol: dayjs(clippedEnd).diff(weekStart, "day"),
      });
    }
    const cols = computeSpanColumns(bars.map((b) => ({ key: b.key, span: [b.startCol, b.endCol + 1] })));
    let maxStack = 0;
    const placed = bars.map((b) => {
      const stackRow = cols.get(b.key)?.col ?? 0;
      maxStack = Math.max(maxStack, stackRow + 1);
      return { bar: b, stackRow };
    });
    return { bars: placed, maxStack };
  }, [items, dates]);

  // Dated notes/tasks split the same way events are: allDay (or timeless)
  // ones join the all-day strip, timed ones get positioned in the hour grid.
  const allDayNotesByDate = useMemo(() => {
    const m = new Map<string, NoteDto[]>();
    for (const d of dates) m.set(d, []);
    for (const n of notes) {
      if (!n.dueDate || !n.allDay) continue;
      m.get(n.dueDate.slice(0, 10))?.push(n);
    }
    return m;
  }, [notes, dates]);
  const timedNotesByDate = useMemo(() => {
    const m = new Map<string, NoteDto[]>();
    for (const d of dates) m.set(d, []);
    for (const n of notes) {
      if (!n.dueDate || n.allDay) continue;
      m.get(n.dueDate.slice(0, 10))?.push(n);
    }
    return m;
  }, [notes, dates]);
  const allDayTasksByDate = useMemo(() => {
    const m = new Map<string, TaskDto[]>();
    for (const d of dates) m.set(d, []);
    for (const t of tasks) {
      const scheduled = t.doDate ?? t.dueDate;
      if (!scheduled || !t.allDay) continue;
      m.get(scheduled.slice(0, 10))?.push(t);
    }
    return m;
  }, [tasks, dates]);
  const timedTasksByDate = useMemo(() => {
    const m = new Map<string, TaskDto[]>();
    for (const d of dates) m.set(d, []);
    for (const t of tasks) {
      const scheduled = t.doDate ?? t.dueDate;
      if (!scheduled || t.allDay) continue;
      m.get(scheduled.slice(0, 10))?.push(t);
    }
    return m;
  }, [tasks, dates]);

  const hasAllDay = dates.some((d) =>
    (allDayByDate.get(d) ?? []).length > 0 || (allDayNotesByDate.get(d) ?? []).length > 0 || (allDayTasksByDate.get(d) ?? []).length > 0,
  );

  // One shared hour range across all 7 columns (they must stay aligned on
  // one vertical axis) — expanded past the 5am-11pm default only if some
  // item or timed note/task this week actually falls outside it.
  const extraTimes = useMemo(() => {
    const times: string[] = [];
    for (const n of notes) if (n.dueDate && !n.allDay) times.push(n.dueDate.slice(11, 16));
    for (const t of tasks) {
      const scheduled = t.doDate ?? t.dueDate;
      if (scheduled && !t.allDay) times.push(scheduled.slice(11, 16));
    }
    return times;
  }, [notes, tasks]);
  const { startHour, endHour } = useMemo(() => computeHourRange(items, extraTimes), [items, extraTimes]);
  const totalH = totalHeight(startHour, endHour);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const h = new Date().getHours();
    scrollRef.current.scrollTop = Math.max(0, (h - startHour - 1) * HOUR_H);
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

      {spanBars.bars.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)`,
          gridAutoRows: SPAN_BAR_H, gap: 2, borderBottom: "1px solid var(--border)", padding: "3px 0",
        }}>
          <div />
          {spanBars.bars.map(({ bar, stackRow }) => {
            const color = eventColor(bar.item.event, tokens);
            return (
              <div
                key={bar.key}
                onClick={() => onTapItem(bar.item)}
                title={bar.item.event.title}
                style={{
                  gridColumn: `${bar.startCol + 2} / ${bar.endCol + 3}`,
                  gridRow: stackRow + 1,
                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, cursor: "pointer",
                  background: color, color: "#fff", lineHeight: `${SPAN_BAR_H - 4}px`,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {bar.item.event.title}
              </div>
            );
          })}
        </div>
      )}

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
              {(allDayNotesByDate.get(d) ?? []).map((n) => {
                const color = n.kind === "reminder" ? tokens.teal : tokens.accent;
                return (
                  <button key={`n-${n.id}`} onClick={() => onTapNote(n)} style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 4, cursor: "pointer",
                    background: n.completed ? "var(--border)" : `${color}18`, color: n.completed ? "var(--ink-soft)" : color,
                    border: `1px dashed ${n.completed ? "var(--ink-soft)" : color}`, textAlign: "left",
                    textDecoration: n.completed ? "line-through" : "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {n.title}
                  </button>
                );
              })}
              {(allDayTasksByDate.get(d) ?? []).map((t) => (
                <button key={`t-${t.id}`} onClick={() => onTapTask(t)} style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 4, cursor: "pointer",
                  background: t.completed ? "var(--border)" : `${tokens.accent}18`, color: t.completed ? "var(--ink-soft)" : tokens.accent,
                  border: `1px dashed ${t.completed ? "var(--ink-soft)" : tokens.accent}`, textAlign: "left",
                  textDecoration: t.completed ? "line-through" : "none",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {t.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ position: "relative", height: totalH, display: "grid", gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)` }}>
          <div style={{ position: "relative" }}>
            <HourGridLines startHour={startHour} endHour={endHour} />
          </div>
          {dates.map((d) => {
            const dayItems = byDate.get(d) ?? [];
            const layout = layoutDayItems(dayItems);
            const noteTaskEntries: TimedNoteTask[] = [
              ...(timedNotesByDate.get(d) ?? []).map((n): TimedNoteTask => ({
                key: `note-${n.id}`, kind: n.kind, title: n.title, time: n.dueDate!.slice(11, 16),
                completed: !!n.completed, onTap: () => onTapNote(n),
              })),
              ...(timedTasksByDate.get(d) ?? []).map((t): TimedNoteTask => ({
                key: `task-${t.id}`, kind: "task", title: t.title, time: (t.doDate ?? t.dueDate)!.slice(11, 16),
                completed: t.completed, onTap: () => onTapTask(t),
              })),
            ];
            const noteTaskLayout = layoutTimedNoteTasks(noteTaskEntries);
            return (
              <TimeGridColumn key={d} date={d} startHour={startHour} endHour={endHour}
                onCreateAt={onCreateAt} onEmptyTap={() => onSelectDay(d)}
                style={{ height: totalH, borderLeft: "1px solid var(--border)" }}>
                <NowIndicator date={d} startHour={startHour} endHour={endHour} left={2} right={2} />
                {dayItems.map((it, i) => {
                  const pos = layout.get(it) ?? { col: 0, cols: 1 };
                  return (
                    <TimeBlock key={`${it.event.id}-${i}`} item={it} startHour={startHour} endHour={endHour} onTap={onTapItem}
                      insetLeft={2} insetRight={2} compact col={pos.col} cols={pos.cols} />
                  );
                })}
                {noteTaskEntries.map((entry) => {
                  const pos = noteTaskLayout.get(entry.key) ?? { col: 0, cols: 1 };
                  return (
                    <NoteTaskBlock key={entry.key} entry={entry} startHour={startHour}
                      insetLeft={2} insetRight={2} col={pos.col} cols={pos.cols} />
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
