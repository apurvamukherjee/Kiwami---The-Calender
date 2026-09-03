import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Segmented } from "antd";
import { motion, useReducedMotion } from "framer-motion";
import { TbAlertCircle, TbArrowRight, TbPill, TbCalendarEvent, TbListCheck, TbChecklist, TbShoppingBag, TbSparkles, TbTarget } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { todayKey } from "../../lib/date.utils";
import { useCalendarEvents } from "../calendar/useCalendarEvents";
import { eventColor } from "../calendar/timeGrid";
import { useTasks, taskMatchesFilter } from "../../lib/tasks";
import { TaskAgendaRow } from "../tasks/TaskAgendaRow";
import { useTodayMedicationOccurrences } from "../../lib/medications";
import { MedicationCard } from "./MedicationCard";
import { useTodayChores, useChores } from "../../lib/chores";
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

// Working-memory research (Cowan 2001, Oberauer 2019) puts a realistic
// focus-zone ceiling around 3-5 chunks — see Appendix B. This caps the
// "Now/Focus" zone only; the full scrollable digest below it is unbounded,
// same as every other section in this file.
const FOCUS_ZONE_CAP = 5;

// "All" is intentionally bounded, not literally unbounded — a digest that
// tries to list every calendar event forever isn't a digest anymore (the
// full Calendar tab already exists for that). 30 days is generous enough
// to feel like "everything coming up" without an unbounded query.
const WEEK_AHEAD_DAYS = 6; // today + 6 = a 7-day window
const ALL_AHEAD_DAYS = 30;

type DigestScope = "today" | "week" | "all";

const SCOPE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "All", value: "all" },
];

interface FocusItem {
  kind: "medication" | "event" | "task";
  title: string;
  time?: string; // absent for the one untimed "big task" slot
  taskId?: number;
}

// The cross-domain "what does today actually look like" screen — a superset
// of Calendar's own TodayView.tsx (which stays untouched and calendar-scoped:
// events/routines/food/tasks/reminders), adding medications/chores/inventory/
// shopping. Deliberately reuses the SAME useCalendarEvents/useTasks hooks
// TodayView already calls for the Schedule/Tasks sections rather than a new
// query, and reuses MedicationCard/ChoreCard/InventoryItemRow/BuyListRow
// verbatim for their sections instead of rebuilding row UIs — see
// LIFE_TAB_FEATURE_PLAN.md §6 for the full section-order rationale, and
// §15/Appendix B for the Today/This Week/All scope control added here.
export function TodayDigest({ onGoToDate, onGoToTask, onSwitchView }: Props) {
  const tokens = useTokens();
  const today = todayKey();
  const [scope, setScope] = useState<DigestScope>("today");

  const rangeEnd = useMemo(() => {
    if (scope === "today") return today;
    const aheadDays = scope === "week" ? WEEK_AHEAD_DAYS : ALL_AHEAD_DAYS;
    return dayjs(today).add(aheadDays, "day").format("YYYY-MM-DD");
  }, [scope, today]);

  const calendarItems = useCalendarEvents(today, rangeEnd);
  const allTasks = useTasks();
  // Medications intentionally stay "today's occurrences" regardless of scope
  // — a medication's schedule is a today/PRN concept, not naturally a
  // "look ahead a week" list without a real per-day grouped view (a bigger
  // lift than this pass took on; see LIFE_TAB_FEATURE_PLAN.md §15).
  const medicationOccurrences = useTodayMedicationOccurrences();
  const todayChores = useTodayChores();
  const allChores = useChores();
  const runningLow = useRunningLowItems();
  const buyList = useBuyListItems();

  const relevantTasks = useMemo(() => {
    if (scope === "all") {
      // Reuses TasksPage's own board-level filter verbatim (lib/tasks.ts) —
      // "all" here means the same thing it means on the Tasks board itself:
      // every not-completed, not-won't-do task, undated/recurring included.
      return allTasks
        .filter((t) => taskMatchesFilter(t, "all", true, today))
        .sort((a, b) => (a.doDate ?? a.dueDate ?? "￿").localeCompare(b.doDate ?? b.dueDate ?? "￿"));
    }
    return allTasks
      .filter((t) => {
        if (t.wontDo) return false;
        const scheduled = (t.doDate ?? t.dueDate)?.slice(0, 10);
        if (!scheduled) return false;
        return (scheduled >= today && scheduled <= rangeEnd) || (scheduled < today && !t.completed);
      })
      .sort((a, b) => (a.doDate ?? a.dueDate ?? "").localeCompare(b.doDate ?? b.dueDate ?? ""));
  }, [allTasks, today, rangeEnd, scope]);

  const chores = useMemo(() => {
    if (scope === "today") return todayChores;
    return allChores.filter((c) => {
      if (c.archived || c.completed) return false;
      const due = c.dueDate?.slice(0, 10);
      if (scope === "all") return true; // every still-open chore, any date
      return !due || due <= rangeEnd; // "week": due within the window (overdue ones already <= rangeEnd too)
    });
  }, [scope, todayChores, allChores, rangeEnd]);

  // "All" broadens Shopping from just the urgent-right-now items to every
  // not-yet-bought item — "today"/"week" stay focused on what's actually
  // urgent, since a full shopping list isn't a "what's coming up" concept.
  const shoppingItems = useMemo(
    () => (scope === "all" ? buyList.filter((b) => !b.bought) : buyList.filter((b) => b.urgency === "now" && !b.bought)),
    [scope, buyList],
  );

  const missedDoses = useMemo(() => medicationOccurrences.filter((o) => o.status === "missed"), [medicationOccurrences]);
  const overdueChores = useMemo(() => todayChores.filter((c) => c.dueDate && c.dueDate.slice(0, 10) < today), [todayChores, today]);

  // "Now/Focus" zone: up to FOCUS_ZONE_CAP items mixing every type, timed
  // items first in chronological order, with the single highest-priority
  // still-open task due today folded in at the end regardless of time — the
  // "the one big task is eligible for the focus zone regardless of time"
  // rule from the Home-tab UX research (see Appendix B). Deliberately still
  // a *lens* on the sections below, not a second source of truth: nothing
  // here is only visible in this zone. Scoped to "today" only — "what's due
  // right now" doesn't mean anything while browsing a week-wide/all view.
  const nowFocus = useMemo(() => {
    if (scope !== "today") return [];
    const nowTime = dayjs().format("HH:mm");
    const upcomingMeds: FocusItem[] = medicationOccurrences
      .filter((o) => o.status === "pending" && o.scheduledTime >= nowTime)
      .map((o) => ({ kind: "medication", time: o.scheduledTime, title: o.medication.name }));
    const upcomingEvents: FocusItem[] = calendarItems
      .filter((it) => !it.event.allDay && it.time && it.time >= nowTime)
      .map((it) => ({ kind: "event", time: it.time!, title: it.event.title }));
    const timed = [...upcomingMeds, ...upcomingEvents].sort((a, b) => a.time!.localeCompare(b.time!));

    const bigTask = relevantTasks.find((t) => !t.completed && (t.priority === "urgent" || t.priority === "high"));
    const focusItems = bigTask ? [...timed, { kind: "task" as const, title: bigTask.title, taskId: bigTask.id }] : timed;
    return focusItems.slice(0, FOCUS_ZONE_CAP);
  }, [scope, medicationOccurrences, calendarItems, relevantTasks]);

  const medDoneCount = useMemo(() => medicationOccurrences.filter((o) => o.status === "done").length, [medicationOccurrences]);
  const taskDoneCount = useMemo(() => relevantTasks.filter((t) => t.completed).length, [relevantTasks]);

  const showCatchUp = scope === "today" && (missedDoses.length > 0 || overdueChores.length > 0);
  const nothingToShow = !showCatchUp && nowFocus.length === 0 && medicationOccurrences.length === 0 && calendarItems.length === 0
    && relevantTasks.length === 0 && chores.length === 0 && runningLow.length === 0 && shoppingItems.length === 0;

  const shouldReduceMotion = useReducedMotion();

  const headerTitle = scope === "today" ? dayjs(today).format("dddd") : scope === "week" ? "This Week" : "Everything open";
  const headerSubtitle = scope === "today"
    ? dayjs(today).format("D MMMM YYYY")
    : scope === "week"
      ? `${dayjs(today).format("D MMM")} – ${dayjs(rangeEnd).format("D MMM YYYY")}`
      : "Not scoped to a date — the full Calendar tab has the real grid";
  const emptyMessage = scope === "today" ? "Nothing on your plate today" : scope === "week" ? "Nothing on your plate this week" : "Nothing open right now";

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.2 }}
      style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 0 8px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800 }}>{headerTitle}</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{headerSubtitle}</div>
        </div>
        <Segmented size="small" value={scope} onChange={(v) => setScope(v as DigestScope)} options={SCOPE_OPTIONS} />
      </div>

      {nothingToShow ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "64px 20px", color: "var(--ink-soft)" }}>
          <TbSparkles size={24} style={{ opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>{emptyMessage}</div>
        </div>
      ) : (
        <>
          {showCatchUp && (
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

          {nowFocus.length > 0 && (
            <Section title="Now / Focus" icon={<TbTarget size={13} />}>
              {nowFocus.map((f, i) => (
                <div
                  key={`${f.kind}-${i}`}
                  onClick={f.kind === "task" && f.taskId != null ? () => onGoToTask(f.taskId!) : undefined}
                  style={{ padding: "9px 4px", display: "flex", alignItems: "center", gap: 10, cursor: f.kind === "task" ? "pointer" : "default" }}
                >
                  {f.kind === "medication" ? <TbPill size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    : f.kind === "event" ? <TbCalendarEvent size={13} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
                    : <TbListCheck size={13} style={{ color: "var(--gold)", flexShrink: 0 }} />}
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)", width: 42, flexShrink: 0 }}>
                    {f.time ?? "Today"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{f.title}</span>
                </div>
              ))}
            </Section>
          )}

          {medicationOccurrences.length > 0 && (
            <Section title="Medications" icon={<TbPill size={13} />} progress={`${medDoneCount}/${medicationOccurrences.length}`}>
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
                .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
                .map((it, i) => (
                  <div
                    key={`${it.event.id}-${i}`}
                    onClick={() => onGoToDate(it.date)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "9px 4px", cursor: "pointer",
                      borderLeft: `3px solid ${eventColor(it.event, tokens)}`,
                    }}
                  >
                    <div style={{ width: scope === "today" ? 56 : 76, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: scope === "today" ? 12 : 11, fontWeight: 700, color: "var(--ink-soft)" }}>
                      {scope === "today" ? (it.event.allDay ? "All day" : it.time) : `${dayjs(it.date).format("D MMM")}${it.event.allDay ? "" : ` ${it.time ?? ""}`}`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.event.title}
                    </div>
                  </div>
                ))}
            </Section>
          )}

          {relevantTasks.length > 0 && (
            <Section title="Tasks" icon={<TbListCheck size={13} />} progress={`${taskDoneCount}/${relevantTasks.length}`}>
              {relevantTasks.map((t: TaskDto) => <TaskAgendaRow key={t.id} task={t} onTap={(task) => onGoToTask(task.id!)} dateFormat="full" />)}
            </Section>
          )}

          {(chores.length > 0 || runningLow.length > 0) && (
            <Section title="Chores & Household" icon={<TbChecklist size={13} />}>
              {chores.map((c) => <ChoreCard key={c.id} chore={c} onEdit={() => onSwitchView("chores")} />)}
              {runningLow.map((item) => <InventoryItemRow key={item.id} item={item} onEdit={() => onSwitchView("inventory")} />)}
            </Section>
          )}

          {shoppingItems.length > 0 && (
            <Section title="Shopping" icon={<TbShoppingBag size={13} />}>
              {shoppingItems.map((item) => <BuyListRow key={item.id} item={item} onEdit={() => onSwitchView("shopping")} />)}
            </Section>
          )}
        </>
      )}
    </motion.div>
  );
}

// `progress` is a quiet "x/y done" count — per-category momentum, never a
// combined day score. Kiwami's hero momentum signal stays the Ember Chain;
// this is deliberately a small, glanceable secondary readout, not a second
// gamification system competing with it (see Appendix B's "category-
// specific, not unified score" recommendation).
function Section({ title, icon, progress, children }: { title: string; icon: React.ReactNode; progress?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="label-caps" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px", color: "var(--ink-soft)", fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>{icon} {title}</span>
        {progress && <span style={{ fontFamily: "var(--font-mono)" }}>{progress}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}
