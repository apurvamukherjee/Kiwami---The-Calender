import { useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { useTokens } from "../../hooks/useTokens";
import {
  HOUR_H, HourGridLines, NowIndicator, totalHeight, computeHourRange,
  TimeBlock, TimeGridColumn, layoutDayItems, eventColor,
  NoteTaskBlock, layoutTimedNoteTasks, type TimedNoteTask,
} from "./timeGrid";
import { isItemOnDate, isSpanningItem } from "./useCalendarEvents";
import type { CalendarItem } from "./useCalendarEvents";
import type { NoteDto, TaskDto } from "../../db/types";

const GUTTER = 56;

interface Props {
  date: string;
  items: CalendarItem[];
  notes: NoteDto[];
  tasks: TaskDto[];
  onTapItem: (item: CalendarItem) => void;
  onTapNote: (note: NoteDto) => void;
  onTapTask: (task: TaskDto) => void;
  onCreateAt: (date: string, time: string, endTime: string) => void;
}

// Single wide column — more room per event than Week view affords, so this
// is where TimeBlock's non-compact detail (time range + duration) actually
// gets to breathe.
export function DayView({ date, items, notes, tasks, onTapItem, onTapNote, onTapTask, onCreateAt }: Props) {
  const tokens = useTokens();
  // A multi-day event shows in the all-day strip on every date within its
  // span, same as a real all-day event — isItemOnDate handles the range
  // containment check (a no-op for normal single-day items).
  const dayItems = useMemo(() => items.filter((it) => isItemOnDate(it, date) && !it.event.allDay && !isSpanningItem(it)), [items, date]);
  const allDayItems = useMemo(() => items.filter((it) => isItemOnDate(it, date) && (it.event.allDay || isSpanningItem(it))), [items, date]);
  const dayNotes = useMemo(() => notes.filter((n) => n.dueDate?.slice(0, 10) === date), [notes, date]);
  const dayTasks = useMemo(() => tasks.filter((t) => (t.doDate ?? t.dueDate)?.slice(0, 10) === date), [tasks, date]);
  const allDayNotes = useMemo(() => dayNotes.filter((n) => n.allDay), [dayNotes]);
  const timedNotes = useMemo(() => dayNotes.filter((n) => !n.allDay), [dayNotes]);
  const allDayTasks = useMemo(() => dayTasks.filter((t) => t.allDay), [dayTasks]);
  const timedTasks = useMemo(() => dayTasks.filter((t) => !t.allDay), [dayTasks]);
  const noteTaskEntries: TimedNoteTask[] = useMemo(() => [
    ...timedNotes.map((n): TimedNoteTask => ({
      key: `note-${n.id}`, kind: n.kind, title: n.title, time: n.dueDate!.slice(11, 16),
      completed: !!n.completed, onTap: () => onTapNote(n),
    })),
    ...timedTasks.map((t): TimedNoteTask => ({
      key: `task-${t.id}`, kind: "task", title: t.title, time: (t.doDate ?? t.dueDate)!.slice(11, 16),
      completed: t.completed, onTap: () => onTapTask(t),
    })),
  ], [timedNotes, timedTasks, onTapNote, onTapTask]);
  const noteTaskLayout = useMemo(() => layoutTimedNoteTasks(noteTaskEntries), [noteTaskEntries]);
  const layout = useMemo(() => layoutDayItems(dayItems), [dayItems]);
  const extraTimes = useMemo(() => noteTaskEntries.map((e) => e.time), [noteTaskEntries]);
  const { startHour, endHour } = useMemo(() => computeHourRange(dayItems, extraTimes), [dayItems, extraTimes]);
  const totalH = totalHeight(startHour, endHour);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const h = new Date().getHours();
    scrollRef.current.scrollTop = Math.max(0, (h - startHour - 1) * HOUR_H);
  }, [date, startHour]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{dayjs(date).format("dddd, D MMMM")}</div>
      </div>

      {(allDayItems.length > 0 || allDayNotes.length > 0 || allDayTasks.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 20px", borderBottom: "1px solid var(--border)" }}>
          {allDayItems.map((it, i) => {
            const color = eventColor(it.event, tokens);
            return (
              <button key={i} onClick={() => onTapItem(it)} style={{
                fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: `${color}22`, color, textAlign: "left", width: "fit-content",
              }}>
                {it.event.title}
                {isSpanningItem(it) && <span style={{ fontWeight: 500, opacity: 0.75 }}> · {it.date} – {it.spanEndDate}</span>}
              </button>
            );
          })}
          {allDayNotes.map((n) => {
            const color = n.kind === "reminder" ? tokens.teal : tokens.accent;
            return (
              <button key={`n-${n.id}`} onClick={() => onTapNote(n)} style={{
                fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                background: n.completed ? "var(--border)" : `${color}18`, color: n.completed ? "var(--ink-soft)" : color,
                border: `1px dashed ${n.completed ? "var(--ink-soft)" : color}`, textAlign: "left", width: "fit-content",
                textDecoration: n.completed ? "line-through" : "none",
              }}>
                {n.title}
              </button>
            );
          })}
          {allDayTasks.map((t) => (
            <button key={`t-${t.id}`} onClick={() => onTapTask(t)} style={{
              fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
              background: t.completed ? "var(--border)" : `${tokens.accent}18`, color: t.completed ? "var(--ink-soft)" : tokens.accent,
              border: `1px dashed ${t.completed ? "var(--ink-soft)" : tokens.accent}`, textAlign: "left", width: "fit-content",
              textDecoration: t.completed ? "line-through" : "none",
            }}>
              {t.title}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ position: "relative", height: totalH, display: "grid", gridTemplateColumns: `${GUTTER}px 1fr` }}>
          <div style={{ position: "relative" }}>
            <HourGridLines startHour={startHour} endHour={endHour} />
          </div>
          <TimeGridColumn date={date} startHour={startHour} endHour={endHour} onCreateAt={onCreateAt}
            style={{ height: totalH, borderLeft: "1px solid var(--border)" }}>
            <NowIndicator date={date} startHour={startHour} endHour={endHour} left={2} right={16} />
            {dayItems.map((it, i) => {
              const pos = layout.get(it) ?? { col: 0, cols: 1 };
              return (
                <TimeBlock key={`${it.event.id}-${i}`} item={it} startHour={startHour} endHour={endHour} onTap={onTapItem}
                  insetLeft={10} insetRight={16} col={pos.col} cols={pos.cols} />
              );
            })}
            {noteTaskEntries.map((entry) => {
              const pos = noteTaskLayout.get(entry.key) ?? { col: 0, cols: 1 };
              return (
                <NoteTaskBlock key={entry.key} entry={entry} startHour={startHour}
                  insetLeft={10} insetRight={16} col={pos.col} cols={pos.cols} />
              );
            })}
          </TimeGridColumn>
        </div>
      </div>
    </div>
  );
}
