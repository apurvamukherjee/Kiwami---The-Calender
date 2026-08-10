import { useMemo } from "react";
import dayjs from "dayjs";
import { TbFlame, TbToolsKitchen2, TbCalendarEvent, TbListCheck, TbBell, TbSparkles } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { todayKey } from "../../lib/date.utils";
import { useCalendarEvents, type CalendarItem } from "./useCalendarEvents";
import { eventColor } from "./timeGrid";
import { EmberChain } from "../../components/EmberChain";
import { useRecentBeads } from "../routines/useRoutineStreak";
import { useTasks } from "../../lib/tasks";
import { useNotes } from "../../lib/notes";
import { NoteListItem } from "../notes/NoteListItem";
import { TaskAgendaRow } from "../tasks/TaskAgendaRow";
import type { NoteDto, TaskDto } from "../../db/types";

const CHAIN_DAYS = 7;

interface Props {
  onTapItem: (item: CalendarItem) => void;
  onTapNote: (note: NoteDto) => void;
  onTapTask: (task: TaskDto) => void;
}

function RoutineChainBadge({ eventId }: { eventId: number | undefined }) {
  const beads = useRecentBeads(eventId, CHAIN_DAYS);
  return <EmberChain beads={beads} size="compact" />;
}

// A single-glance "what does today actually look like" dashboard — merges
// routines, food slots, plain events, dated tasks, and reminders, which
// otherwise live behind five separate query hooks and (for tasks/reminders
// specifically) three other pages entirely. Deliberately self-querying
// (its own useCalendarEvents/useTasks/useNotes calls) rather than reusing
// CalendarPage's range-bound `items`/`notes`/`tasks` props — those are
// bound to whatever [rangeStart, rangeEnd] the active view computed, which
// would miss overdue tasks/reminders sitting before that window. Folded
// into the Calendar view switcher rather than a new top-level section (the
// nav already has Calendar/Notes/Tasks; this is a lens on the same data,
// not a fourth data domain), so it doesn't participate in currentDate
// navigation — it always shows the real "today", not whatever date the
// other views last navigated to.
export function TodayView({ onTapItem, onTapNote, onTapTask }: Props) {
  const tokens = useTokens();
  const today = todayKey();
  const items = useCalendarEvents(today, today);
  const allTasks = useTasks();
  const reminders = useNotes("reminder");

  const routineItems = useMemo(() => items.filter((it) => it.event.isRoutine).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")), [items]);
  const foodItems = useMemo(() => items.filter((it) => it.event.isFoodSlot).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")), [items]);
  const eventItems = useMemo(
    () => items.filter((it) => !it.event.isRoutine && !it.event.isFoodSlot).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    [items],
  );

  // Overdue-and-still-open, or scheduled for today (done-today ones stay
  // visible, dimmed by TaskAgendaRow/NoteListItem — a completed item
  // vanishing the instant it's checked off would read as data loss, not
  // progress). Undated backlog tasks belong on the Tasks board, not here.
  const relevantTasks = useMemo(
    () => allTasks
      .filter((t) => {
        if (t.wontDo) return false;
        const scheduled = (t.doDate ?? t.dueDate)?.slice(0, 10);
        if (!scheduled) return false;
        return scheduled === today || (scheduled < today && !t.completed);
      })
      .sort((a, b) => (a.doDate ?? a.dueDate ?? "").localeCompare(b.doDate ?? b.dueDate ?? "")),
    [allTasks, today],
  );
  const relevantReminders = useMemo(
    () => reminders
      .filter((n) => {
        const scheduled = n.dueDate?.slice(0, 10);
        if (!scheduled) return false;
        return scheduled === today || (scheduled < today && !n.completed);
      })
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [reminders, today],
  );

  const nothingToday = routineItems.length === 0 && foodItems.length === 0 && eventItems.length === 0
    && relevantTasks.length === 0 && relevantReminders.length === 0;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "18px 24px 4px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800 }}>{dayjs(today).format("dddd")}</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{dayjs(today).format("D MMMM YYYY")}</div>
      </div>

      {nothingToday ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "64px 20px", color: "var(--ink-soft)" }}>
          <TbSparkles size={24} style={{ opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>Nothing on your plate today</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 24 }}>
          {routineItems.length > 0 && (
            <Section title="Routines" icon={<TbFlame size={13} />}>
              {routineItems.map((it, i) => {
                const color = eventColor(it.event, tokens);
                const status = it.occurrenceStatus?.status;
                return (
                  <Row key={`r-${it.event.id}-${i}`} onClick={() => onTapItem(it)} color={color} time={it.time}
                    title={it.event.title} dimmed={status === "done" || status === "missed"} strike={status === "missed"}>
                    <RoutineChainBadge eventId={it.event.id} />
                  </Row>
                );
              })}
            </Section>
          )}

          {foodItems.length > 0 && (
            <Section title="Food" icon={<TbToolsKitchen2 size={13} />}>
              {foodItems.map((it, i) => {
                const color = eventColor(it.event, tokens);
                const status = it.occurrenceStatus?.status;
                return (
                  <Row key={`f-${it.event.id}-${i}`} onClick={() => onTapItem(it)} color={color} time={it.time}
                    title={it.event.title} dimmed={status === "done" || status === "missed"} strike={status === "missed"} />
                );
              })}
            </Section>
          )}

          {eventItems.length > 0 && (
            <Section title="Events" icon={<TbCalendarEvent size={13} />}>
              {eventItems.map((it, i) => (
                <Row key={`e-${it.event.id}-${i}`} onClick={() => onTapItem(it)} color={eventColor(it.event, tokens)}
                  time={it.event.allDay ? "All day" : it.time} title={it.event.title} />
              ))}
            </Section>
          )}

          {relevantTasks.length > 0 && (
            <Section title="Tasks" icon={<TbListCheck size={13} />}>
              {relevantTasks.map((t) => <TaskAgendaRow key={t.id} task={t} onTap={onTapTask} dateFormat="full" />)}
            </Section>
          )}

          {relevantReminders.length > 0 && (
            <Section title="Reminders" icon={<TbBell size={13} />}>
              {relevantReminders.map((n) => <NoteListItem key={n.id} note={n} onTap={onTapNote} dateFormat="full" />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="label-caps" style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 24px", color: "var(--ink-soft)", fontSize: 11 }}>
        {icon} {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ onClick, color, time, title, dimmed, strike, children }: {
  onClick: () => void; color: string; time?: string; title: string; dimmed?: boolean; strike?: boolean; children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "9px 24px", cursor: "pointer",
        borderLeft: `3px solid ${color}`, opacity: dimmed ? 0.6 : 1,
      }}
    >
      <div style={{ width: 56, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
        {time ?? "All day"}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, textDecoration: strike ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </div>
      {children}
    </div>
  );
}
