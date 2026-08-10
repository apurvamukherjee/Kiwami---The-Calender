// Shared hour-grid primitives used by both DayView (single day) and WeekView
// (7-day grid) so both stay pixel-identical and a future timing tweak only
// has to happen once. Adapted from the sibling project's calendar (same
// long-press-then-drag interaction model), retyped from a flat task list to
// Kiwami's CalendarItem (an event + a concrete occurrence date).
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, CSSProperties } from "react";
import { motion, useDragControls } from "framer-motion";
import { TbGripVertical, TbRepeat, TbFlame, TbToolsKitchen2, TbListCheck, TbBell, TbNote } from "react-icons/tb";
import { updateEvent } from "../../lib/events";
import { combineDateTime } from "../../lib/date.utils";
import { hapticLight } from "../../lib/haptics";
import { useTokens } from "../../hooks/useTokens";
import type { EventDto } from "../../db/types";
import type { CalendarItem } from "./useCalendarEvents";

export const HOUR_H = 56; // px per hour
export const SNAP = 15; // snap to 15-min grid
export const DEFAULT_START_HOUR = 5; // grid starts at 5am by default
export const DEFAULT_END_HOUR = 23; // ends at 11pm by default

export function totalHeight(startHour: number, endHour: number): number {
  return (endHour - startHour) * HOUR_H;
}

// The default 5am-11pm window covers ordinary waking hours densely; an
// event outside it used to just be invisible in Week/Day (it still rendered
// fine in Month/Agenda, which don't use this grid) — this expands the
// window, rounded to whole hours, only when something actually needs it.
// `extraTimes` folds in timed notes/tasks (HH:mm) so a task due before 5am
// or after 11pm still pulls the grid open, same as an event would.
export function computeHourRange(items: CalendarItem[], extraTimes: string[] = []): { startHour: number; endHour: number } {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const it of items) {
    if (it.event.allDay || !it.time) continue;
    const [h] = it.time.split(":").map(Number);
    if (h < startHour) startHour = h;
    let endH = h + 1;
    if (it.endTime) {
      const [eh, em] = it.endTime.split(":").map(Number);
      endH = em > 0 ? eh + 1 : eh;
    }
    if (endH > endHour) endHour = Math.min(24, endH);
  }
  for (const time of extraTimes) {
    const [h] = time.split(":").map(Number);
    if (h < startHour) startHour = h;
    if (h + 1 > endHour) endHour = Math.min(24, h + 1);
  }
  return { startHour, endHour };
}

export function isToday(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10);
}

// Always returns a concrete hex (never a CSS var) so callers can safely
// alpha-blend it via string concatenation (`${color}20`) — a CSS var string
// like "var(--accent)20" is not valid CSS.
export function eventColor(event: EventDto, tokens: { accent: string; teal: string }): string {
  if (event.isFoodSlot) return tokens.teal;
  return event.color ?? tokens.accent;
}

// pointerEvents: "none" throughout — purely decorative, must never intercept
// taps or TimeGridColumn could never see an "empty space" gesture underneath.
export function HourGridLines({ startHour, endHour, showLabels = true }: {
  startHour: number; endHour: number; showLabels?: boolean;
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  return (
    <div style={{ pointerEvents: "none" }}>
      {hours.map((h) => {
        const top = (h - startHour) * HOUR_H;
        return (
          <div key={h} style={{ position: "absolute", top, left: 0, right: 0, height: HOUR_H }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "var(--border)", opacity: 0.6 }} />
            {showLabels && (
              <span style={{
                position: "absolute", top: 2, left: 8,
                fontSize: 10, color: "var(--ink-soft)", fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}>
                {String(h % 24).padStart(2, "0")}:00
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NowIndicator({ date, startHour, endHour, left = 46, right = 8 }: {
  date: string; startHour: number; endHour: number; left?: number; right?: number;
}) {
  if (!isToday(date)) return null;
  const now = new Date();
  const mins = (now.getHours() - startHour) * 60 + now.getMinutes();
  if (mins < 0 || mins > totalHeight(startHour, endHour)) return null;
  return (
    <div style={{ position: "absolute", top: mins, left, right, height: 2, background: "var(--accent)", borderRadius: 1, zIndex: 5, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: -4, top: -4, width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} />
    </div>
  );
}

function snapMinutes(y: number, totalH: number): number {
  const snapped = Math.round(y / SNAP) * SNAP;
  return Math.max(0, Math.min(totalH - 15, snapped));
}
function minutesToTime(mins: number, startHour: number): string {
  const h = startHour + Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 8;

// Only used for relative overlap comparisons within one render, so the
// reference point doesn't matter as long as it's the same for every item —
// plain minutes-since-midnight works regardless of the grid's own startHour.
function itemSpan(item: CalendarItem): [number, number] {
  const [h, m] = (item.time ?? "09:00").split(":").map(Number);
  const start = h * 60 + m;
  let end = start + 30;
  if (item.endTime) {
    const [eh, em] = item.endTime.split(":").map(Number);
    end = Math.max(start + 15, eh * 60 + em);
  }
  return [start, end];
}

// Google-Calendar-style side-by-side layout for items that overlap in time.
// Greedy interval partitioning: sort by start, place each in the first
// column whose last item has already ended, opening a new column otherwise.
// Generic over a string key so both events (layoutDayItems) and timed
// notes/tasks (layoutTimedNoteTasks) share one algorithm without either
// needing to know about the other's shape. Exported — MonthView.tsx reuses
// it too, for stacking overlapping multi-day event bars within a week row
// (same greedy interval-partitioning problem, just day-columns instead of
// minutes; `col` becomes a vertical stack index there rather than a
// horizontal column).
export function computeSpanColumns(entries: { key: string; span: [number, number] }[]): Map<string, { col: number; cols: number }> {
  const sorted = [...entries].sort((a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1]);
  const result = new Map<string, { col: number; cols: number }>();
  let cluster: typeof sorted = [];
  let clusterEnd = -Infinity;

  function flush() {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const placed: { key: string; col: number }[] = [];
    for (const entry of cluster) {
      let col = colEnds.findIndex((end) => end <= entry.span[0]);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(entry.span[1]);
      } else {
        colEnds[col] = entry.span[1];
      }
      placed.push({ key: entry.key, col });
    }
    const cols = colEnds.length;
    for (const { key, col } of placed) result.set(key, { col, cols });
    cluster = [];
  }

  for (const entry of sorted) {
    if (cluster.length === 0 || entry.span[0] < clusterEnd) {
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, entry.span[1]);
    } else {
      flush();
      cluster.push(entry);
      clusterEnd = entry.span[1];
    }
  }
  flush();
  return result;
}

export function layoutDayItems(items: CalendarItem[]): Map<CalendarItem, { col: number; cols: number }> {
  const withKeys = items
    .filter((it) => it.event.id != null && !it.event.allDay)
    .map((it, i) => ({ it, key: `${it.event.id}-${it.date}-${i}`, span: itemSpan(it) }));
  const cols = computeSpanColumns(withKeys.map(({ key, span }) => ({ key, span })));
  const result = new Map<CalendarItem, { col: number; cols: number }>();
  for (const { it, key } of withKeys) {
    const c = cols.get(key);
    if (c) result.set(it, c);
  }
  return result;
}

// A dated Task/Reminder rendered at its time-of-day in the hourly grid —
// deliberately laid out in its own independent column group rather than
// merged with layoutDayItems' event columns: a real event/task time clash is
// rare, and merging the two overlap-avoidance systems would mean every event
// column position could shift depending on which tasks happen to be due that
// day, which is a bigger behavior change than this feature needs. Notes/tasks
// render as a slim, dashed-border marker (matching TaskAgendaRow's existing
// dashed-border convention for a task row) instead of a full-height block.
export interface TimedNoteTask {
  key: string; // `note-${id}` / `task-${id}`
  kind: "note" | "task" | "reminder";
  title: string;
  time: string; // HH:mm
  completed: boolean;
  onTap: () => void;
}

export function layoutTimedNoteTasks(entries: TimedNoteTask[]): Map<string, { col: number; cols: number }> {
  const spans = entries.map((e) => {
    const [h, m] = e.time.split(":").map(Number);
    const start = h * 60 + m;
    return { key: e.key, span: [start, start + 30] as [number, number] };
  });
  return computeSpanColumns(spans);
}

// Wraps one day's grid column. Long-press (400ms) then drag stakes out a
// time range and calls onCreateAt; a plain quick tap on empty space fires
// onEmptyTap instead (WeekView uses it to drill into DayView). The
// threshold exists so ordinary vertical scrolling never misfires as create.
export function TimeGridColumn({ date, startHour, endHour, onCreateAt, onEmptyTap, style, children }: {
  date: string;
  startHour: number;
  endHour: number;
  onCreateAt?: (date: string, time: string, endTime: string) => void;
  onEmptyTap?: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const tokens = useTokens();
  const totalH = totalHeight(startHour, endHour);
  const pressTimer = useRef<number | null>(null);
  const startYRef = useRef(0);
  const [dragRange, setDragRange] = useState<{ start: number; end: number } | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !onCreateAt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    startYRef.current = e.clientY - rect.top;
    pressTimer.current = window.setTimeout(() => {
      hapticLight();
      setDragRange({ start: startYRef.current, end: startYRef.current });
    }, LONG_PRESS_MS);
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (pressTimer.current && !dragRange) {
      if (Math.abs(y - startYRef.current) > MOVE_CANCEL_PX) {
        window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      return;
    }
    if (!dragRange) return;
    setDragRange((d) => (d ? { ...d, end: y } : d));
  }
  function endDrag() {
    if (dragRange) {
      const a = snapMinutes(Math.min(dragRange.start, dragRange.end), totalH);
      const bRaw = snapMinutes(Math.max(dragRange.start, dragRange.end), totalH);
      const b = Math.max(a + 30, bRaw);
      setDragRange(null);
      onCreateAt?.(date, minutesToTime(a, startHour), minutesToTime(b, startHour));
      return;
    }
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
      onEmptyTap?.();
    }
  }
  function cancelPress() {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerLeave={cancelPress}
      style={{ position: "relative", ...style }}
    >
      {children}
      {dragRange && (() => {
        const top = Math.min(dragRange.start, dragRange.end);
        const h = Math.max(30, Math.abs(dragRange.end - dragRange.start));
        return (
          <div style={{
            position: "absolute", top, left: 2, right: 2, height: h,
            background: `${tokens.accent}25`,
            border: `2px dashed ${tokens.accent}`,
            borderRadius: 6, zIndex: 15, pointerEvents: "none",
          }} />
        );
      })()}
    </div>
  );
}

interface TimeBlockProps {
  item: CalendarItem;
  startHour: number;
  endHour: number;
  onTap?: (item: CalendarItem) => void;
  insetLeft?: number;
  insetRight?: number;
  compact?: boolean;
  col?: number;
  cols?: number;
}

// Dragging arms only after a deliberate long-press (dragListener={false} +
// dragControls.start on a timer) instead of the instant a finger touches the
// block — otherwise every vertical scroll that happens to start on a chip
// (nearly every scroll, on a busy day) would misfire as a reschedule.
// Recurring items (item.rule set) are never draggable/resizable: the
// recurrence engine is deliberately simplified with no per-occurrence time
// override, so moving one instance would either have to silently move the
// whole series or be a dead end — instead they're tap-only (open the editor
// to change the series' time) and show a repeat glyph instead of a grip handle.
export function TimeBlock({ item, startHour, endHour, onTap, insetLeft = 52, insetRight = 8, compact = false, col = 0, cols = 1 }: TimeBlockProps) {
  const [dragging, setDragging] = useState(false);
  const dragControls = useDragControls();
  const pressTimer = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const tokens = useTokens();
  const color = eventColor(item.event, tokens);
  const [h, m] = (item.time ?? "09:00").split(":").map(Number);
  const top = (h - startHour) * 60 + m;
  const totalH = totalHeight(startHour, endHour);
  const draggable = !item.rule;

  let height = 30;
  if (item.endTime) {
    const [eh, em] = item.endTime.split(":").map(Number);
    height = Math.max(20, (eh * 60 + em) - (h * 60 + m));
  }
  const isBlock = height > 30;
  const done = item.occurrenceStatus?.status === "done";
  const missed = item.occurrenceStatus?.status === "missed";

  function clearPressTimer() {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  }
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggable) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    const evt = e.nativeEvent;
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      hapticLight();
      dragControls.start(evt);
    }, LONG_PRESS_MS);
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pressTimer.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearPressTimer();
  }

  async function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    setDragging(false);
    if (!item.event.id) return;
    const newTop = Math.max(0, Math.min(totalH - height, top + info.offset.y));
    const snapped = Math.round(newTop / SNAP) * SNAP;
    const newTime = minutesToTime(snapped, startHour);

    let newEndTime: string | undefined;
    if (item.endTime) {
      const delta = snapped - top;
      const [oeh, oem] = item.endTime.split(":").map(Number);
      const endSnapped = oeh * 60 + oem + delta;
      newEndTime = `${String(Math.floor(endSnapped / 60) % 24).padStart(2, "0")}:${String(((endSnapped % 60) + 60) % 60).padStart(2, "0")}`;
    }

    await updateEvent(item.event.id, {
      startTime: combineDateTime(item.date, newTime),
      endTime: newEndTime ? combineDateTime(item.date, newEndTime) : undefined,
    });
    hapticLight();
  }

  const leftStyle = cols > 1
    ? `calc(${insetLeft}px + (100% - ${insetLeft + insetRight}px) * ${col / cols})`
    : insetLeft;
  const widthStyle = cols > 1
    ? `calc((100% - ${insetLeft + insetRight}px) / ${cols} - 3px)`
    : undefined;

  return (
    <motion.div
      layout
      drag={draggable ? "y" : false}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPressTimer}
      onPointerLeave={clearPressTimer}
      onPointerCancel={clearPressTimer}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={() => onTap?.(item)}
      whileDrag={{ scale: 1.03, zIndex: 20, boxShadow: "0 6px 20px rgba(0,0,0,0.35)" }}
      transition={{ type: "spring", damping: 30, stiffness: 400 }}
      style={{
        position: "absolute",
        top, left: leftStyle, right: cols > 1 ? undefined : insetRight, width: widthStyle,
        height: Math.max(20, height),
        background: done || missed ? "var(--border)" : `${color}22`,
        borderLeft: `3px solid ${done || missed ? "var(--ink-soft)" : color}`,
        borderRadius: 6,
        padding: compact ? "1px 4px" : "2px 8px",
        cursor: "pointer",
        zIndex: dragging ? 20 : 2,
        display: "flex", alignItems: "flex-start", gap: 4,
        overflow: "hidden",
        opacity: done || missed ? 0.55 : 1,
      }}
    >
      {!compact && (
        item.event.isRoutine ? <TbFlame size={12} style={{ color, marginTop: 2, flexShrink: 0 }} />
        : item.event.isFoodSlot ? <TbToolsKitchen2 size={12} style={{ color, marginTop: 2, flexShrink: 0 }} />
        : item.rule ? <TbRepeat size={12} style={{ color: "var(--ink-soft)", marginTop: 2, flexShrink: 0 }} />
        : <TbGripVertical size={12} style={{ color: "var(--ink-soft)", marginTop: 2, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: compact ? 10 : 11, fontWeight: 700,
          color: done || missed ? "var(--ink-soft)" : color,
          textDecoration: missed ? "line-through" : "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {item.event.title}
        </div>
        {isBlock && !compact && (
          <div style={{ fontSize: 9, color: "var(--ink-soft)" }}>
            {item.time}–{item.endTime} · {height}min
          </div>
        )}
      </div>
      {!compact && draggable && !done && !missed && (
        <ResizeHandle item={item} top={top} height={height} startHour={startHour} endHour={endHour} />
      )}
    </motion.div>
  );
}

function ResizeHandle({ item, top, height, startHour, endHour }: {
  item: CalendarItem; top: number; height: number; startHour: number; endHour: number;
}) {
  const [dragging, setDragging] = useState(false);
  const totalH = totalHeight(startHour, endHour);

  async function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    setDragging(false);
    if (!item.event.id || !item.time) return;
    const rawHeight = height + info.offset.y;
    const snappedHeight = Math.max(15, Math.round(rawHeight / SNAP) * SNAP);
    const endMin = Math.min(totalH, top + snappedHeight);
    const newEndTime = minutesToTime(Math.max(top + 15, endMin), startHour);
    await updateEvent(item.event.id, { endTime: combineDateTime(item.date, newEndTime) });
    hapticLight();
  }

  return (
    <motion.div
      drag="y"
      dragMomentum={false}
      dragElastic={0}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.15 }}
      style={{
        position: "absolute", bottom: -3, left: "50%", marginLeft: -14,
        width: 28, height: 7, borderRadius: 4,
        background: "var(--ink-soft)", opacity: dragging ? 1 : 0.4,
        cursor: "ns-resize", zIndex: 25, touchAction: "none",
      }}
    />
  );
}

interface NoteTaskBlockProps {
  entry: TimedNoteTask;
  startHour: number;
  insetLeft?: number;
  insetRight?: number;
  col?: number;
  cols?: number;
}

// Tap-only, non-draggable — a task/reminder's "time" is just a due moment,
// not a duration to resize, and rescheduling one by dragging would need to
// write back to a different table (tasks/notes) than TimeBlock's updateEvent,
// a bigger feature than this pass needs. Same "tap to open the editor"
// treatment recurring events already get in TimeBlock above.
export function NoteTaskBlock({ entry, startHour, insetLeft = 52, insetRight = 8, col = 0, cols = 1 }: NoteTaskBlockProps) {
  const tokens = useTokens();
  const color = entry.kind === "reminder" ? tokens.teal : entry.kind === "note" ? tokens.ash : tokens.accent;
  const [h, m] = entry.time.split(":").map(Number);
  const top = (h - startHour) * 60 + m;
  const Icon = entry.kind === "reminder" ? TbBell : entry.kind === "note" ? TbNote : TbListCheck;

  const leftStyle = cols > 1
    ? `calc(${insetLeft}px + (100% - ${insetLeft + insetRight}px) * ${col / cols})`
    : insetLeft;
  const widthStyle = cols > 1
    ? `calc((100% - ${insetLeft + insetRight}px) / ${cols} - 3px)`
    : undefined;

  return (
    <div
      onClick={entry.onTap}
      style={{
        position: "absolute", top, left: leftStyle, right: cols > 1 ? undefined : insetRight, width: widthStyle,
        height: 20, zIndex: 3,
        background: entry.completed ? "var(--border)" : `${color}1c`,
        borderLeft: `2px dashed ${entry.completed ? "var(--ink-soft)" : color}`,
        borderRadius: 5, padding: "1px 6px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 4, overflow: "hidden",
        opacity: entry.completed ? 0.55 : 1,
      }}
    >
      <Icon size={10} style={{ color: entry.completed ? "var(--ink-soft)" : color, flexShrink: 0 }} />
      <div style={{
        fontSize: 10, fontWeight: 700, color: entry.completed ? "var(--ink-soft)" : color,
        textDecoration: entry.completed ? "line-through" : "none",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {entry.title}
      </div>
    </div>
  );
}
