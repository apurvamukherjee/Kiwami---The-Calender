import { useMemo } from "react";
import dayjs from "dayjs";
import { Popover } from "antd";
import { TbNote, TbListCheck, TbBell, TbSquareCheck } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { eventColor } from "./timeGrid";
import type { CalendarItem } from "./useCalendarEvents";
import type { NoteDto, TaskDto } from "../../db/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PILLS = 3;
const NOTE_KIND_ICON = { note: TbNote, task: TbListCheck, reminder: TbBell };

interface Props {
  rangeStart: string;
  rangeEnd: string;
  currentDate: string;
  items: CalendarItem[];
  notes: NoteDto[];
  tasks: TaskDto[];
  onTapItem: (item: CalendarItem) => void;
  onTapNote: (note: NoteDto) => void;
  onTapTask: (task: TaskDto) => void;
  onSelectDay: (date: string) => void;
}

// Full-bleed grid filling all available width/height — a desktop calendar
// surface, not a mobile card. Cells hold a fixed number of pills + a
// "+N more" popover for overflow, same pattern Google Calendar uses.
export function MonthView({ rangeStart, rangeEnd, currentDate, items, notes, tasks, onTapItem, onTapNote, onTapTask, onSelectDay }: Props) {
  const tokens = useTokens();

  const days = useMemo(() => {
    const out: string[] = [];
    let d = dayjs(rangeStart);
    const end = dayjs(rangeEnd);
    while (!d.isAfter(end)) {
      out.push(d.format("YYYY-MM-DD"));
      d = d.add(1, "day");
    }
    return out;
  }, [rangeStart, rangeEnd]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const arr = map.get(it.date);
      if (arr) arr.push(it);
      else map.set(it.date, [it]);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    return map;
  }, [items]);

  const notesByDate = useMemo(() => {
    const map = new Map<string, NoteDto[]>();
    for (const n of notes) {
      if (!n.dueDate) continue;
      const key = n.dueDate.slice(0, 10);
      const arr = map.get(key);
      if (arr) arr.push(n);
      else map.set(key, [n]);
    }
    return map;
  }, [notes]);

  // Merged into the same per-day dot badge as notesByDate below (a distinct
  // icon disambiguates a real Kanban task from a lightweight NoteDto
  // kind:"task" row) — keeps the dense Month grid to one small dot per day
  // rather than a second badge.
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const t of tasks) {
      const key = (t.doDate ?? t.dueDate)?.slice(0, 10);
      if (!key) continue;
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [tasks]);

  const currentMonth = dayjs(currentDate).format("YYYY-MM");
  const today = dayjs().format("YYYY-MM-DD");
  const weekRows = days.length / 7;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} style={{ padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${weekRows}, 1fr)` }}>
        {days.map((date) => {
          const inMonth = date.slice(0, 7) === currentMonth;
          const isToday = date === today;
          const dayItems = itemsByDate.get(date) ?? [];
          const visible = dayItems.slice(0, MAX_PILLS);
          const overflow = dayItems.length - visible.length;
          const dayNotes = notesByDate.get(date) ?? [];
          const dayTasks = tasksByDate.get(date) ?? [];
          return (
            <div
              key={date}
              onClick={() => onSelectDay(date)}
              style={{
                position: "relative",
                borderRight: "1px solid var(--border)", borderBottom: isToday ? "3px solid var(--accent)" : "1px solid var(--border)",
                padding: 6, display: "flex", flexDirection: "column", gap: 3, cursor: "pointer",
                opacity: inMonth ? 1 : 0.42,
                background: isToday ? `${tokens.accent}12` : "transparent",
                minHeight: 0, minWidth: 0, overflow: "hidden",
              }}
            >
              {isToday && (
                <div style={{
                  position: "absolute", top: -20, right: -20, width: 60, height: 60, borderRadius: "50%",
                  background: `radial-gradient(circle, ${tokens.accent}30, transparent 70%)`,
                  filter: "blur(14px)", pointerEvents: "none",
                }} />
              )}
              {(dayNotes.length > 0 || dayTasks.length > 0) && (
                <Popover
                  trigger="click"
                  content={
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 240 }}>
                      {dayNotes.map((n) => {
                        const Icon = NOTE_KIND_ICON[n.kind];
                        return (
                          <div key={`note-${n.id}`} onClick={() => onTapNote(n)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                            <Icon size={12} style={{ flexShrink: 0, color: "var(--ink-soft)" }} />
                            {n.title}
                          </div>
                        );
                      })}
                      {dayTasks.map((t) => (
                        <div key={`task-${t.id}`} onClick={() => onTapTask(t)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, textDecoration: t.completed ? "line-through" : "none" }}>
                          <TbSquareCheck size={12} style={{ flexShrink: 0, color: "var(--accent)" }} />
                          {t.title}
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%",
                      background: "var(--teal)", cursor: "pointer", zIndex: 1,
                    }}
                    aria-label={`${dayNotes.length + dayTasks.length} item${dayNotes.length + dayTasks.length > 1 ? "s" : ""}`}
                  />
                </Popover>
              )}
              <div style={{
                width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: "0.02em",
                background: isToday ? "var(--accent)" : "transparent",
                color: isToday ? "#fff" : "var(--ink)",
                position: "relative", zIndex: 1,
              }}>
                {dayjs(date).date()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, overflow: "hidden" }}>
                {visible.map((it, i) => {
                  const color = eventColor(it.event, tokens);
                  const missed = it.occurrenceStatus?.status === "missed";
                  const done = it.occurrenceStatus?.status === "done";
                  return (
                    <div
                      key={`${it.event.id}-${i}`}
                      onClick={(e) => { e.stopPropagation(); onTapItem(it); }}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 5,
                        background: done || missed ? "var(--border)" : `${color}22`,
                        color: done || missed ? "var(--ink-soft)" : color,
                        textDecoration: missed ? "line-through" : "none",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {it.time && <span style={{ opacity: 0.75 }}>{it.time} </span>}{it.event.title}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <Popover
                    trigger="click"
                    content={
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 240 }}>
                        {dayItems.map((it, i) => {
                          const color = eventColor(it.event, tokens);
                          return (
                            <div key={i} onClick={() => onTapItem(it)} style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color }}>
                              {it.time && <span style={{ opacity: 0.7, color: "var(--ink-soft)" }}>{it.time} </span>}{it.event.title}
                            </div>
                          );
                        })}
                      </div>
                    }
                  >
                    <div onClick={(e) => e.stopPropagation()} className="label-caps" style={{ color: "var(--ink-soft)", cursor: "pointer" }}>
                      +{overflow} more
                    </div>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
