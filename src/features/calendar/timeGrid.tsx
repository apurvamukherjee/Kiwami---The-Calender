// Shared hour-grid primitives used by both DayView (single day) and WeekView
// (7-day grid) so both stay pixel-identical and a future timing tweak only
// has to happen once. Adapted from the sibling project's calendar (same
// long-press-then-drag interaction model), retyped from a flat task list to
// Kiwami's CalendarItem (an event + a concrete occurrence date).
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, CSSProperties } from "react";
import { motion, useDragControls } from "framer-motion";
import { TbGripVertical, TbRepeat, TbFlame, TbToolsKitchen2 } from "react-icons/tb";
import { updateEvent } from "../../lib/events";
import { combineDateTime } from "../../lib/date.utils";
import { hapticLight } from "../../lib/haptics";
import { useTokens } from "../../hooks/useTokens";
import type { EventDto } from "../../db/types";
import type { CalendarItem } from "./useCalendarEvents";

export const HOUR_H = 56; // px per hour
export const SNAP = 15; // snap to 15-min grid
export const START_HOUR = 5; // grid starts at 5am
export const END_HOUR = 23; // ends at 11pm
export const TOTAL_H = (END_HOUR - START_HOUR) * HOUR_H;

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
export function HourGridLines({ showLabels = true }: { showLabels?: boolean }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  return (
    <div style={{ pointerEvents: "none" }}>
      {hours.map((h) => {
        const top = (h - START_HOUR) * HOUR_H;
        return (
          <div key={h} style={{ position: "absolute", top, left: 0, right: 0, height: HOUR_H }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "var(--border)", opacity: 0.6 }} />
            {showLabels && (
              <span style={{
                position: "absolute", top: 2, left: 8,
                fontSize: 10, color: "var(--ink-soft)", fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}>
                {String(h).padStart(2, "0")}:00
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NowIndicator({ date, left = 46, right = 8 }: { date: string; left?: number; right?: number }) {
  if (!isToday(date)) return null;
  const now = new Date();
  const mins = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  if (mins < 0 || mins > TOTAL_H) return null;
  return (
    <div style={{ position: "absolute", top: mins, left, right, height: 2, background: "var(--accent)", borderRadius: 1, zIndex: 5, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: -4, top: -4, width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} />
    </div>
  );
}

function snapMinutes(y: number): number {
  const snapped = Math.round(y / SNAP) * SNAP;
  return Math.max(0, Math.min(TOTAL_H - 15, snapped));
}
function minutesToTime(mins: number): string {
  const h = START_HOUR + Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 8;

function itemSpan(item: CalendarItem): [number, number] {
  const [h, m] = (item.time ?? "09:00").split(":").map(Number);
  const start = (h - START_HOUR) * 60 + m;
  let end = start + 30;
  if (item.endTime) {
    const [eh, em] = item.endTime.split(":").map(Number);
    end = Math.max(start + 15, (eh - START_HOUR) * 60 + em);
  }
  return [start, end];
}

// Google-Calendar-style side-by-side layout for items that overlap in time.
// Greedy interval partitioning: sort by start, place each in the first
// column whose last item has already ended, opening a new column otherwise.
export function layoutDayItems(items: CalendarItem[]): Map<CalendarItem, { col: number; cols: number }> {
  const withSpans = items
    .filter((it) => it.event.id != null && !it.event.allDay)
    .map((it) => ({ it, span: itemSpan(it) }))
    .sort((a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1]);

  const result = new Map<CalendarItem, { col: number; cols: number }>();
  let cluster: typeof withSpans = [];
  let clusterEnd = -Infinity;

  function flush() {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const placed: { item: CalendarItem; col: number }[] = [];
    for (const entry of cluster) {
      let col = colEnds.findIndex((end) => end <= entry.span[0]);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(entry.span[1]);
      } else {
        colEnds[col] = entry.span[1];
      }
      placed.push({ item: entry.it, col });
    }
    const cols = colEnds.length;
    for (const { item, col } of placed) result.set(item, { col, cols });
    cluster = [];
  }

  for (const entry of withSpans) {
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

// Wraps one day's grid column. Long-press (400ms) then drag stakes out a
// time range and calls onCreateAt; a plain quick tap on empty space fires
// onEmptyTap instead (WeekView uses it to drill into DayView). The
// threshold exists so ordinary vertical scrolling never misfires as create.
export function TimeGridColumn({ date, onCreateAt, onEmptyTap, style, children }: {
  date: string;
  onCreateAt?: (date: string, time: string, endTime: string) => void;
  onEmptyTap?: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const tokens = useTokens();
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
      const a = snapMinutes(Math.min(dragRange.start, dragRange.end));
      const bRaw = snapMinutes(Math.max(dragRange.start, dragRange.end));
      const b = Math.max(a + 30, bRaw);
      setDragRange(null);
      onCreateAt?.(date, minutesToTime(a), minutesToTime(b));
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
export function TimeBlock({ item, onTap, insetLeft = 52, insetRight = 8, compact = false, col = 0, cols = 1 }: TimeBlockProps) {
  const [dragging, setDragging] = useState(false);
  const dragControls = useDragControls();
  const pressTimer = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const tokens = useTokens();
  const color = eventColor(item.event, tokens);
  const [h, m] = (item.time ?? "09:00").split(":").map(Number);
  const top = (h - START_HOUR) * 60 + m;
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
    const newTop = Math.max(0, Math.min(TOTAL_H - height, top + info.offset.y));
    const snapped = Math.round(newTop / SNAP) * SNAP;
    const newTime = minutesToTime(snapped);

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
        <ResizeHandle item={item} top={top} height={height} />
      )}
    </motion.div>
  );
}

function ResizeHandle({ item, top, height }: { item: CalendarItem; top: number; height: number }) {
  const [dragging, setDragging] = useState(false);

  async function handleDragEnd(_: unknown, info: { offset: { y: number } }) {
    setDragging(false);
    if (!item.event.id || !item.time) return;
    const rawHeight = height + info.offset.y;
    const snappedHeight = Math.max(15, Math.round(rawHeight / SNAP) * SNAP);
    const endMin = Math.min(TOTAL_H, top + snappedHeight);
    const newEndTime = minutesToTime(Math.max(top + 15, endMin));
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
