import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import dayjs from "dayjs";
import { Button, Segmented, DatePicker } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { TbChevronLeft, TbChevronRight, TbPlus, TbSettings, TbFlame, TbToolsKitchen2, TbCalendarPlus, TbActivity, TbSearch } from "react-icons/tb";
import { db } from "../../db/db";
import { useIsMobile } from "../../hooks/useIsMobile";
import { SettingsSheet } from "../../components/SettingsSheet";
import { SectionTabs } from "../../components/SectionTabs";
import type { Section } from "../../components/BottomNav";
import { useNotesForRange } from "../../lib/notes";
import { NoteEditorSheet } from "../notes/NoteEditorSheet";
import { useTasksForRange, useTaskLists, useTaskTags } from "../../lib/tasks";
import { TaskDetailSheet } from "../tasks/TaskDetailSheet";
import type { NoteDto, TaskDto } from "../../db/types";
import { useCalendarRange, type CalendarView } from "./useCalendarRange";
import { useCalendarEvents, type CalendarItem } from "./useCalendarEvents";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { AgendaView } from "./AgendaView";
import { EventEditorSheet } from "./EventEditorSheet";
import { RoutineDetailSheet } from "../routines/RoutineDetailSheet";
import { YearHeatmapSheet } from "../routines/YearHeatmapSheet";
import { FoodLogSheet } from "../food/FoodLogSheet";
import { todayKey } from "../../lib/date.utils";

// Tiptap (the rich-text editor NoteFullEditor pulls in) is the single
// heaviest Notes-only dependency — lazy-loaded so it's only fetched the
// moment a "note"-kind item is actually opened, not bundled into this
// section's chunk unconditionally.
const NoteFullEditor = lazy(() => import("../notes/NoteFullEditor").then((m) => ({ default: m.NoteFullEditor })));

const DESKTOP_VIEWS = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
  { label: "Agenda", value: "agenda" },
];
const MOBILE_VIEWS = [
  { label: "Day", value: "day" },
  { label: "Agenda", value: "agenda" },
];

// A search-result jump (asDay: true) switches into Day view on that date, matching
// selectDay's existing behavior; a plain "Go to today" (asDay: false) only moves the
// current date, preserving whatever view is active — matching the toolbar's own
// Today button. `nonce` forces the consuming effect to re-fire even when `date`
// happens to be unchanged from the last request (e.g. "today" pressed twice).
export interface CalendarNavRequest {
  date: string;
  asDay: boolean;
  nonce: number;
}

interface Props {
  section: Section;
  onChangeSection: (s: Section) => void;
  onOpenPalette: () => void;
  pendingNav?: CalendarNavRequest | null;
  onConsumePendingNav: () => void;
}

// Full-width desktop calendar shell (toolbar + active view filling the rest
// of the viewport) that collapses to Day+Agenda only below the mobile
// breakpoint — not a phone card scaled up, a real responsive app shell.
export function CalendarPage({ section, onChangeSection, onOpenPalette, pendingNav, onConsumePendingNav }: Props) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(todayKey());
  const { rangeStart, rangeEnd } = useCalendarRange(view, currentDate);
  const items = useCalendarEvents(rangeStart, rangeEnd);
  const notes = useNotesForRange(rangeStart, rangeEnd);
  const tasks = useTasksForRange(rangeStart, rangeEnd);
  const taskLists = useTaskLists();
  const taskTags = useTaskTags();
  const eventCount = useLiveQuery(() => db.events.count(), []);
  const showEmptyState = eventCount === 0;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{ date?: string; time?: string; endTime?: string }>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false);
  const [routineItem, setRoutineItem] = useState<CalendarItem | null>(null);
  const [foodSheetOpen, setFoodSheetOpen] = useState(false);
  const [foodItem, setFoodItem] = useState<CalendarItem | null>(null);
  const [yearHeatmapOpen, setYearHeatmapOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteFullEditorOpen, setNoteFullEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteDto | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [editingCalTask, setEditingCalTask] = useState<TaskDto | null>(null);

  useEffect(() => {
    if (isMobile && (view === "month" || view === "week")) setView("day");
  }, [isMobile, view]);

  const anySheetOpen = editorOpen || routineSheetOpen || foodSheetOpen || settingsOpen || noteEditorOpen || noteFullEditorOpen || taskDetailOpen;

  // Arrow-key date nav + "T" for Today — skipped while typing anywhere or
  // while a sheet is open, so it never fights with form inputs.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (anySheetOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "t" || e.key === "T") setCurrentDate(todayKey());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Command Palette itself now lives in App.tsx (Tasks is a sibling top-level section,
  // not nested under Calendar, so Ctrl/Cmd+K and the palette instance had to move up
  // to work from every section). A search-result jump arrives here as `pendingNav`.
  useEffect(() => {
    if (!pendingNav) return;
    if (pendingNav.asDay) selectDay(pendingNav.date);
    else setCurrentDate(pendingNav.date);
    onConsumePendingNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNav]);

  const periodLabel = useMemo(() => {
    const d = dayjs(currentDate);
    if (view === "month") return d.format("MMMM YYYY");
    if (view === "week") {
      const start = dayjs(rangeStart), end = dayjs(rangeEnd);
      return start.isSame(end, "month")
        ? `${start.format("MMM D")} – ${end.format("D, YYYY")}`
        : `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;
    }
    if (view === "day") return d.format("dddd, D MMMM YYYY");
    return `${dayjs(rangeStart).format("MMM D")} – ${dayjs(rangeEnd).format("MMM D, YYYY")}`;
  }, [view, currentDate, rangeStart, rangeEnd]);

  function step(dir: 1 | -1) {
    if (view === "agenda") {
      setCurrentDate(dayjs(currentDate).add(dir * 30, "day").format("YYYY-MM-DD"));
      return;
    }
    const unit = view === "month" ? "month" : view === "week" ? "week" : "day";
    setCurrentDate(dayjs(currentDate).add(dir, unit).format("YYYY-MM-DD"));
  }

  function openCreate(date?: string, time?: string, endTime?: string) {
    setEditingItem(null);
    setCreateDefaults({ date: date ?? currentDate, time, endTime });
    setEditorOpen(true);
  }
  function openEdit(item: CalendarItem) {
    // Routines get the streak/Done-Missed action sheet first; food slots get
    // the lighter Ate/Skipped log. Both route into the full EventEditorSheet
    // via their own "Edit" button.
    if (item.event.isRoutine) {
      setRoutineItem(item);
      setRoutineSheetOpen(true);
      return;
    }
    if (item.event.isFoodSlot) {
      setFoodItem(item);
      setFoodSheetOpen(true);
      return;
    }
    setEditingItem(item);
    setEditorOpen(true);
  }
  function selectDay(date: string) {
    setCurrentDate(date);
    setView("day");
  }
  function openNote(note: NoteDto) {
    setEditingNote(note);
    if (note.kind === "note") setNoteFullEditorOpen(true);
    else setNoteEditorOpen(true);
  }
  function openCalTask(task: TaskDto) {
    setEditingCalTask(task);
    setTaskDetailOpen(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
        borderBottom: "1px solid var(--border)", flexWrap: "wrap", flexShrink: 0,
        background: "var(--toolbar-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        position: "relative", zIndex: 10,
      }} className="safe-top">
        {!isMobile && <SectionTabs section={section} onChange={onChangeSection} />}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Button size="small" onClick={() => setCurrentDate(todayKey())}>Today</Button>
          <Button size="small" type="text" icon={<TbChevronLeft size={16} />} onClick={() => step(-1)} aria-label="Previous period" />
          <Button size="small" type="text" icon={<TbChevronRight size={16} />} onClick={() => step(1)} aria-label="Next period" />
          <DatePicker
            size="small"
            value={dayjs(currentDate)}
            onChange={(d) => d && setCurrentDate(d.format("YYYY-MM-DD"))}
            allowClear={false}
            inputReadOnly
            format="D MMM 'YY"
            style={{ width: 100 }}
            aria-label="Jump to date"
          />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1, minWidth: 140 }}>{periodLabel}</div>
        <Segmented value={view} onChange={(v) => setView(v as CalendarView)} options={isMobile ? MOBILE_VIEWS : DESKTOP_VIEWS} />
        <Button type="primary" icon={<TbPlus size={15} />} onClick={() => openCreate()}>New</Button>
        <Button type="text" icon={<TbSearch size={16} />} onClick={onOpenPalette} aria-label="Search (Ctrl+K)" />
        <Button type="text" icon={<TbActivity size={17} />} onClick={() => setYearHeatmapOpen(true)} aria-label="Year in review" />
        <Button type="text" icon={<TbSettings size={17} />} onClick={() => setSettingsOpen(true)} aria-label="Settings" />
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {showEmptyState && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10, display: "flex",
            alignItems: "center", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{
              pointerEvents: "auto", maxWidth: 380, textAlign: "center", padding: 28,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Nothing here yet</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 16 }}>
                Create a plain event for anything one-off. Mark it a{" "}
                <TbFlame size={13} style={{ verticalAlign: -2, color: "var(--accent)" }} /> <b>Routine</b> to
                track a daily streak, or a <TbToolsKitchen2 size={13} style={{ verticalAlign: -2, color: "var(--teal)" }} />{" "}
                <b>Food slot</b> (via Settings) to log meal-time adherence.
              </div>
              <Button type="primary" icon={<TbCalendarPlus size={15} />} onClick={() => openCreate()}>
                New event
              </Button>
            </div>
          </div>
        )}
        {view === "month" && (
          <MonthView rangeStart={rangeStart} rangeEnd={rangeEnd} currentDate={currentDate}
            items={items} notes={notes} tasks={tasks} onTapItem={openEdit} onTapNote={openNote} onTapTask={openCalTask} onSelectDay={selectDay} />
        )}
        {view === "week" && (
          <WeekView rangeStart={rangeStart} items={items} onTapItem={openEdit}
            onCreateAt={(d, t, e) => openCreate(d, t, e)} onSelectDay={selectDay} />
        )}
        {view === "day" && (
          <DayView date={currentDate} items={items} onTapItem={openEdit}
            onCreateAt={(d, t, e) => openCreate(d, t, e)} />
        )}
        {view === "agenda" && <AgendaView items={items} notes={notes} tasks={tasks} onTapItem={openEdit} onTapNote={openNote} onTapTask={openCalTask} />}
      </div>

      <EventEditorSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        item={editingItem}
        defaultDate={createDefaults.date}
        defaultTime={createDefaults.time}
        defaultEndTime={createDefaults.endTime}
      />
      <RoutineDetailSheet
        open={routineSheetOpen}
        onClose={() => setRoutineSheetOpen(false)}
        item={routineItem}
        onEdit={(it) => { setEditingItem(it); setEditorOpen(true); }}
      />
      <FoodLogSheet
        open={foodSheetOpen}
        onClose={() => setFoodSheetOpen(false)}
        item={foodItem}
        onEdit={(it) => { setEditingItem(it); setEditorOpen(true); }}
      />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <YearHeatmapSheet open={yearHeatmapOpen} onClose={() => setYearHeatmapOpen(false)} />
      <NoteEditorSheet open={noteEditorOpen} onClose={() => setNoteEditorOpen(false)} note={editingNote} />
      {noteFullEditorOpen && (
        <Suspense fallback={null}>
          <NoteFullEditor note={editingNote} onClose={() => setNoteFullEditorOpen(false)} />
        </Suspense>
      )}
      <TaskDetailSheet open={taskDetailOpen} onClose={() => setTaskDetailOpen(false)} task={editingCalTask} lists={taskLists} tags={taskTags} />
    </div>
  );
}
