import { useMemo } from "react";
import dayjs from "dayjs";
import { motion, useReducedMotion } from "framer-motion";
import { TbAlertCircle, TbArrowRight, TbPill, TbCalendarEvent, TbListCheck, TbChecklist, TbShoppingBag, TbSparkles } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { todayKey } from "../../lib/date.utils";
import { useCalendarEvents } from "../calendar/useCalendarEvents";
import { eventColor } from "../calendar/timeGrid";
import { useTasks } from "../../lib/tasks";
import { TaskAgendaRow } from "../tasks/TaskAgendaRow";
import { useTodayMedicationOccurrences } from "../../lib/medications";
import { MedicationCard } from "./MedicationCard";
import { useTodayChores } from "../../lib/chores";
import { ChoreCard } from "./ChoreCard";
import { useRunningLowItems } from "../../lib/inventory";
import { InventoryItemRow } from "./InventoryItemRow";
import { useBuyListItems } from "../../lib/shopping";
import { BuyListRow } from "./BuyListRow";
import type { LifeView } from "./LifePage";
import type { TaskDto } from "../../db/types";

interface Props {
  onGoToDate: (date: string) => void;
  onGoToTask: (taskId: number) => void;
  onSwitchView: (v: LifeView) => void;
}

// The cross-domain "what does today actually look like" screen — a superset
// of Calendar's own TodayView.tsx (which stays untouched and calendar-scoped:
// events/routines/food/tasks/reminders), adding medications/chores/inventory/
// shopping. Deliberately reuses the SAME useCalendarEvents/useTasks hooks
// TodayView already calls for the Schedule/Tasks sections rather than a new
// query, and reuses MedicationCard/ChoreCard/InventoryItemRow/BuyListRow
// verbatim for their sections instead of rebuilding row UIs — see
// LIFE_TAB_FEATURE_PLAN.md §6 for the full section-order rationale.
export function TodayDigest({ onGoToDate, onGoToTask, onSwitchView }: Props) {
  const tokens = useTokens();
  const today = todayKey();

  const calendarItems = useCalendarEvents(today, today);
  const allTasks = useTasks();
  const medicationOccurrences = useTodayMedicationOccurrences();
  const chores = useTodayChores();
  const runningLow = useRunningLowItems();
  const buyList = useBuyListItems();

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

  const missedDoses = useMemo(() => medicationOccurrences.filter((o) => o.status === "missed"), [medicationOccurrences]);
  const overdueChores = useMemo(() => chores.filter((c) => c.dueDate && c.dueDate.slice(0, 10) < today), [chores, today]);
  const urgentBuyList = useMemo(() => buyList.filter((b) => b.urgency === "now" && !b.bought), [buyList]);

  const nowNext = useMemo(() => {
    const nowTime = dayjs().format("HH:mm");
    const upcomingMeds = medicationOccurrences
      .filter((o) => o.status === "pending" && o.scheduledTime >= nowTime)
      .map((o) => ({ kind: "medication" as const, time: o.scheduledTime, title: o.medication.name }));
    const upcomingEvents = calendarItems
      .filter((it) => !it.event.allDay && it.time && it.time >= nowTime)
      .map((it) => ({ kind: "event" as const, time: it.time!, title: it.event.title }));
    return [...upcomingMeds, ...upcomingEvents].sort((a, b) => a.time.localeCompare(b.time))[0];
  }, [medicationOccurrences, calendarItems]);

  const hasCatchUp = missedDoses.length > 0 || overdueChores.length > 0;
  const nothingToday = !hasCatchUp && !nowNext && medicationOccurrences.length === 0 && calendarItems.length === 0
    && relevantTasks.length === 0 && chores.length === 0 && runningLow.length === 0 && urgentBuyList.length === 0;

  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.2 }}
      style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div style={{ padding: "6px 0 8px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800 }}>{dayjs(today).format("dddd")}</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{dayjs(today).format("D MMMM YYYY")}</div>
      </div>

      {nothingToday ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "64px 20px", color: "var(--ink-soft)" }}>
          <TbSparkles size={24} style={{ opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>Nothing on your plate today</div>
        </div>
      ) : (
        <>
          {hasCatchUp && (
            <div
              className="glass"
              style={{
                display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px",
                borderColor: `${tokens.gold}44`, marginBottom: 6,
              }}
            >
              <div className="label-caps" style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--gold)", fontSize: 11 }}>
                <TbAlertCircle size={13} /> Needs attention
              </div>
              {missedDoses.map((o, i) => (
                <div key={`md-${i}`} style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>{o.medication.name} — {o.scheduledTime} dose missed</span>
                  <TbArrowRight size={13} style={{ cursor: "pointer", color: "var(--ink-soft)" }} onClick={() => onSwitchView("medications")} />
                </div>
              ))}
              {overdueChores.map((c) => (
                <div key={`oc-${c.id}`} style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>{c.title} — overdue</span>
                  <TbArrowRight size={13} style={{ cursor: "pointer", color: "var(--ink-soft)" }} onClick={() => onSwitchView("chores")} />
                </div>
              ))}
            </div>
          )}

          {nowNext && (
            <Section title="Now / Next" icon={nowNext.kind === "medication" ? <TbPill size={13} /> : <TbCalendarEvent size={13} />}>
              <div style={{ padding: "9px 4px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)" }}>{nowNext.time}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{nowNext.title}</span>
              </div>
            </Section>
          )}

          {medicationOccurrences.length > 0 && (
            <Section title="Medications" icon={<TbPill size={13} />}>
              {[...new Map(medicationOccurrences.map((o) => [o.medication.id, o.medication])).values()].map((m) => (
                <MedicationCard
                  key={m.id}
                  medication={m}
                  todayOccurrences={medicationOccurrences.filter((o) => o.medication.id === m.id)}
                  onEdit={() => onSwitchView("medications")}
                />
              ))}
            </Section>
          )}

          {calendarItems.length > 0 && (
            <Section title="Schedule" icon={<TbCalendarEvent size={13} />}>
              {calendarItems
                .slice()
                .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
                .map((it, i) => (
                  <div
                    key={`${it.event.id}-${i}`}
                    onClick={() => onGoToDate(today)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "9px 4px", cursor: "pointer",
                      borderLeft: `3px solid ${eventColor(it.event, tokens)}`,
                    }}
                  >
                    <div style={{ width: 56, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
                      {it.event.allDay ? "All day" : it.time}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.event.title}
                    </div>
                  </div>
                ))}
            </Section>
          )}

          {relevantTasks.length > 0 && (
            <Section title="Tasks" icon={<TbListCheck size={13} />}>
              {relevantTasks.map((t: TaskDto) => <TaskAgendaRow key={t.id} task={t} onTap={(task) => onGoToTask(task.id!)} dateFormat="full" />)}
            </Section>
          )}

          {(chores.length > 0 || runningLow.length > 0) && (
            <Section title="Chores & Household" icon={<TbChecklist size={13} />}>
              {chores.map((c) => <ChoreCard key={c.id} chore={c} onEdit={() => onSwitchView("chores")} />)}
              {runningLow.map((item) => <InventoryItemRow key={item.id} item={item} onEdit={() => onSwitchView("inventory")} />)}
            </Section>
          )}

          {urgentBuyList.length > 0 && (
            <Section title="Shopping" icon={<TbShoppingBag size={13} />}>
              {urgentBuyList.map((item) => <BuyListRow key={item.id} item={item} onEdit={() => onSwitchView("shopping")} />)}
            </Section>
          )}
        </>
      )}
    </motion.div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="label-caps" style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 4px", color: "var(--ink-soft)", fontSize: 11 }}>
        {icon} {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}
