import { useMemo } from "react";
import dayjs from "dayjs";
import { Checkbox } from "antd";
import { TbFlame, TbToolsKitchen2, TbRepeat, TbSquareCheck } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { todayKey } from "../../lib/date.utils";
import { eventColor } from "./timeGrid";
import { EmberChain } from "../../components/EmberChain";
import { useRecentBeads } from "../routines/useRoutineStreak";
import { NoteListItem } from "../notes/NoteListItem";
import { completeTask, PRIORITY_TOKEN_KEY } from "../../lib/tasks";
import { hapticLight } from "../../lib/haptics";
import type { CalendarItem } from "./useCalendarEvents";
import type { NoteDto, TaskDto } from "../../db/types";

const AGENDA_CHAIN_DAYS = 7;

// Agenda rows have the horizontal room a Month/Week/Day cell doesn't — this
// is the one place besides the routine detail sheet where the Ember Chain
// itself (not just a single done/missed dot) appears, a quick "how's this
// routine been going" glance without opening the detail sheet.
function RoutineChainBadge({ eventId }: { eventId: number | undefined }) {
  const beads = useRecentBeads(eventId, AGENDA_CHAIN_DAYS);
  return <EmberChain beads={beads} size="compact" />;
}

interface Props {
  items: CalendarItem[];
  notes: NoteDto[];
  tasks: TaskDto[];
  onTapItem: (item: CalendarItem) => void;
  onTapNote: (note: NoteDto) => void;
  onTapTask: (task: TaskDto) => void;
}

// Chronological list grouped by day. Days with nothing on them are skipped
// entirely (matches how every mainstream agenda view behaves) rather than
// rendering an empty header for every date in the window. Dated
// Tasks/Reminders from the Notes tab are interleaved into the same day
// groups (rendered via NoteListItem, a dashed-border look distinct from a
// real event's solid color bar) so Agenda stays the one place to see
// everything happening on a given day. Real Kanban tasks (doDate ?? dueDate)
// are interleaved the same way via TaskAgendaRow below.
export function AgendaView({ items, notes, tasks, onTapItem, onTapNote, onTapTask }: Props) {
  const tokens = useTokens();
  const today = todayKey();

  const notesByDate = useMemo(() => {
    const map = new Map<string, NoteDto[]>();
    for (const n of notes) {
      if (!n.dueDate) continue;
      const key = n.dueDate.slice(0, 10);
      const arr = map.get(key);
      if (arr) arr.push(n);
      else map.set(key, [n]);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    return map;
  }, [notes]);

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

  const groups = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const arr = map.get(it.date);
      if (arr) arr.push(it);
      else map.set(it.date, [it]);
    }
    const dates = new Set([...map.keys(), ...notesByDate.keys(), ...tasksByDate.keys()]);
    return [...dates]
      .sort((a, b) => a.localeCompare(b))
      .map((date) => [date, [...(map.get(date) ?? [])].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))] as const);
  }, [items, notesByDate, tasksByDate]);

  if (groups.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>
        Nothing on the calendar in this window.
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {groups.map(([date, dayItems]) => (
        <div key={date}>
          <div style={{
            position: "sticky", top: 0, zIndex: 2, background: "var(--bg)",
            padding: "8px 20px", fontSize: 12, fontWeight: 800, color: "var(--ink-soft)",
            borderBottom: "1px solid var(--border)",
          }}>
            {dayjs(date).format("dddd, D MMMM")}
            {date === today && <span className="label-caps" style={{ color: "var(--accent)", marginLeft: 8 }}>Today</span>}
          </div>
          {dayItems.map((it, i) => {
            const color = eventColor(it.event, tokens);
            const missed = it.occurrenceStatus?.status === "missed";
            const done = it.occurrenceStatus?.status === "done";
            return (
              <div
                key={i}
                onClick={() => onTapItem(it)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer",
                  borderLeft: `3px solid ${color}`, opacity: done || missed ? 0.6 : 1,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ width: 56, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
                  {it.event.allDay ? "All day" : it.time}
                </div>
                {it.event.isRoutine ? <TbFlame size={15} style={{ color, flexShrink: 0 }} />
                  : it.event.isFoodSlot ? <TbToolsKitchen2 size={15} style={{ color, flexShrink: 0 }} />
                  : it.rule ? <TbRepeat size={15} style={{ color: "var(--ink-soft)", flexShrink: 0 }} /> : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, textDecoration: missed ? "line-through" : "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {it.event.title}
                  </div>
                  {it.event.location && (
                    <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{it.event.location}</div>
                  )}
                </div>
                {it.event.isRoutine && <RoutineChainBadge eventId={it.event.id} />}
              </div>
            );
          })}
          {(notesByDate.get(date) ?? []).map((n) => (
            <NoteListItem key={n.id} note={n} onTap={onTapNote} dateFormat="time" />
          ))}
          {(tasksByDate.get(date) ?? []).map((t) => (
            <TaskAgendaRow key={t.id} task={t} onTap={onTapTask} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Condensed row for a real Kanban task scheduled on this day — a dashed left
// border (rather than NoteListItem's solid one) keeps it visually distinct
// from both a real event's solid color bar and a NoteDto row.
function TaskAgendaRow({ task, onTap }: { task: TaskDto; onTap: (task: TaskDto) => void }) {
  const tokens = useTokens();
  const color = tokens[PRIORITY_TOKEN_KEY[task.priority]];
  const scheduled = task.doDate ?? task.dueDate;

  return (
    <div
      onClick={() => onTap(task)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer",
        borderLeft: `3px dashed ${color}`, opacity: task.completed ? 0.6 : 1,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Checkbox
        checked={!!task.completed}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { hapticLight(); void completeTask(task.id!, e.target.checked); }}
      />
      <TbSquareCheck size={15} style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, textDecoration: task.completed ? "line-through" : "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {task.title}
        </div>
      </div>
      {scheduled && !task.allDay && (
        <div style={{ width: 56, flexShrink: 0, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
          {dayjs(scheduled).format("HH:mm")}
        </div>
      )}
    </div>
  );
}
