import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import dayjs from "dayjs";
import { Segmented } from "antd";
import { TbNotes } from "react-icons/tb";
import { useIsMobile } from "../../hooks/useIsMobile";
import { SectionTabs } from "../../components/SectionTabs";
import type { Section } from "../../components/BottomNav";
import { NoteComposer } from "./NoteComposer";
import { NoteListItem } from "./NoteListItem";
import { NoteEditorSheet } from "./NoteEditorSheet";
import { useNotes } from "../../lib/notes";
import { useTasks, useTaskLists, useTaskTags, ensureDefaultTaskLists } from "../../lib/tasks";
import { TaskAgendaRow } from "../tasks/TaskAgendaRow";
import { TaskDetailSheet } from "../tasks/TaskDetailSheet";
import { todayKey } from "../../lib/date.utils";
import type { NoteDto, NoteKind, TaskDto } from "../../db/types";

// See CalendarPage.tsx's identical comment — Tiptap only loads when a
// "note"-kind item is actually opened.
const NoteFullEditor = lazy(() => import("./NoteFullEditor").then((m) => ({ default: m.NoteFullEditor })));

type KindFilter = "all" | NoteKind;
type ViewMode = "timeline" | "all";

const KIND_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Notes", value: "note" },
  { label: "Tasks", value: "task" },
  { label: "Reminders", value: "reminder" },
];

interface Props {
  section: Section;
  onChangeSection: (s: Section) => void;
  // Command Palette note-search jump — same cross-section handoff shape as
  // TasksPage's pendingTaskId (App.tsx's goToNote).
  pendingNoteId?: number;
  onConsumePendingNoteId: () => void;
}

// Notes/Tasks/Reminders shell, mirroring CalendarPage.tsx's structure
// (toolbar + view body). NoteComposer stays pinned above the list so
// quick-capture never requires navigating away from whatever you're
// currently browsing.
//
// "Tasks" here is not a separate data source — it reads the same `tasks`
// Kanban table the Tasks section and Calendar overlay already use (see
// db.ts's v4 migration), rendered via TaskAgendaRow/TaskDetailSheet instead
// of NoteListItem/NoteEditorSheet. Notes/Reminders still live in the
// `notes` table exactly as before.
export function NotesPage({ section, onChangeSection, pendingNoteId, onConsumePendingNoteId }: Props) {
  const isMobile = useIsMobile();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [editing, setEditing] = useState<NoteDto | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [fullEditorOpen, setFullEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);

  const allNotes = useNotes();
  const allTasks = useTasks();
  const taskLists = useTaskLists();
  const taskTags = useTaskTags();
  const today = todayKey();

  useEffect(() => {
    void ensureDefaultTaskLists();
  }, []);

  // kind:"task" notes shouldn't exist post-migration (db.ts v4) — filtered out
  // here as a harmless safety net rather than trusted to be gone.
  const notes = useMemo(() => {
    const base = allNotes.filter((n) => n.kind !== "task");
    if (kindFilter === "all") return base;
    if (kindFilter === "task") return [];
    return base.filter((n) => n.kind === kindFilter);
  }, [allNotes, kindFilter]);

  const tasks = useMemo(() => {
    if (kindFilter !== "all" && kindFilter !== "task") return [];
    return allTasks.filter((t) => !t.wontDo);
  }, [allTasks, kindFilter]);

  // Dated entries grouped by day (Timeline) + a trailing "Unscheduled" group
  // for notes/tasks with no date — same day-grouping shape AgendaView.tsx
  // already uses for the calendar, extended to interleave real Kanban tasks
  // (keyed off doDate ?? dueDate, same convention as everywhere else tasks
  // get scheduled) alongside notes/reminders.
  const { groups, unscheduledNotes, unscheduledTasks } = useMemo(() => {
    const notesByDate = new Map<string, NoteDto[]>();
    for (const n of notes) {
      if (!n.dueDate) continue;
      const key = n.dueDate.slice(0, 10);
      const arr = notesByDate.get(key);
      if (arr) arr.push(n);
      else notesByDate.set(key, [n]);
    }
    for (const arr of notesByDate.values()) arr.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

    const tasksByDate = new Map<string, TaskDto[]>();
    for (const t of tasks) {
      const key = (t.doDate ?? t.dueDate)?.slice(0, 10);
      if (!key) continue;
      const arr = tasksByDate.get(key);
      if (arr) arr.push(t);
      else tasksByDate.set(key, [t]);
    }
    for (const arr of tasksByDate.values()) arr.sort((a, b) => (a.doDate ?? a.dueDate ?? "").localeCompare(b.doDate ?? b.dueDate ?? ""));

    const dates = [...new Set([...notesByDate.keys(), ...tasksByDate.keys()])].sort((a, b) => a.localeCompare(b));

    return {
      groups: dates.map((d) => [d, notesByDate.get(d) ?? [], tasksByDate.get(d) ?? []] as const),
      unscheduledNotes: notes.filter((n) => !n.dueDate),
      unscheduledTasks: tasks.filter((t) => !(t.doDate ?? t.dueDate)),
    };
  }, [notes, tasks]);

  // "All" (ungrouped) feed — notes and tasks interleaved by recency, same
  // ordering useNotes() itself used to give a plain notes-only list.
  const allFeed = useMemo(() => {
    type Entry = { key: string; createdAt: number; note?: NoteDto; task?: TaskDto };
    const noteEntries: Entry[] = notes.map((n) => ({ key: `n${n.id}`, createdAt: n.createdAt, note: n }));
    const taskEntries: Entry[] = tasks.map((t) => ({ key: `t${t.id}`, createdAt: t.createdAt, task: t }));
    return [...noteEntries, ...taskEntries].sort((a, b) => b.createdAt - a.createdAt);
  }, [notes, tasks]);

  // Notes open in the full-screen rich editor (Apple Notes-style); Reminders
  // keep the compact NoteEditorSheet — rich text/full-screen doesn't suit a
  // quick-glance due-date item. Tasks open the same TaskDetailSheet the
  // Kanban board and Calendar use.
  function openNote(n: NoteDto) {
    setEditing(n);
    if (n.kind === "note") setFullEditorOpen(true);
    else setEditorOpen(true);
  }
  function openTask(t: TaskDto) {
    setEditingTask(t);
    setTaskDetailOpen(true);
  }

  // Command Palette note-search jump. Mirrors TasksPage's pendingTaskId
  // effect exactly: on a fresh mount (e.g. jumping here while Calendar was
  // active), useNotes()'s live query hasn't resolved yet on the first
  // render, so this only consumes the request once the note is actually
  // found — letting the effect naturally re-check on the next render instead
  // of silently clearing it against stale (empty) data.
  useEffect(() => {
    if (pendingNoteId == null) return;
    const n = allNotes.find((note) => note.id === pendingNoteId);
    if (!n) return;
    openNote(n);
    onConsumePendingNoteId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNoteId, allNotes, onConsumePendingNoteId]);

  const isEmpty = notes.length === 0 && tasks.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
        borderBottom: "1px solid var(--border)", flexWrap: "wrap", flexShrink: 0,
        background: "var(--toolbar-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        position: "relative", zIndex: 10,
      }} className="safe-top">
        {!isMobile && <SectionTabs section={section} onChange={onChangeSection} />}
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1, minWidth: 100 }}>Notes</div>
        <Segmented size="small" value={kindFilter} onChange={(v) => setKindFilter(v as KindFilter)} options={KIND_FILTER_OPTIONS} />
        <Segmented size="small" value={viewMode} onChange={(v) => setViewMode(v as ViewMode)}
          options={[{ label: "Timeline", value: "timeline" }, { label: "All", value: "all" }]} />
      </div>

      <NoteComposer />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
        {isEmpty && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 28 }}>
            <div style={{
              maxWidth: 380, textAlign: "center", padding: 28,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}>
              <TbNotes size={22} style={{ color: "var(--ink-soft)", marginBottom: 8 }} />
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Nothing here yet</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                Type above to add a Note, a Task, or a Reminder — try something
                like "call mom tomorrow 5pm" and watch the date get picked up
                automatically.
              </div>
            </div>
          </div>
        )}

        {!isEmpty && viewMode === "timeline" && (
          <>
            {groups.map(([date, dayNotes, dayTasks]) => (
              <div key={date}>
                <div style={{
                  position: "sticky", top: 0, zIndex: 2, background: "var(--bg)",
                  padding: "8px 20px", fontSize: 12, fontWeight: 800, color: "var(--ink-soft)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  {dayjs(date).format("dddd, D MMMM")}
                  {date === today && <span className="label-caps" style={{ color: "var(--accent)", marginLeft: 8 }}>Today</span>}
                  {date < today && <span className="label-caps" style={{ color: "var(--danger)", marginLeft: 8 }}>Overdue</span>}
                </div>
                {dayNotes.map((n) => <NoteListItem key={n.id} note={n} onTap={openNote} dateFormat="time" />)}
                {dayTasks.map((t) => <TaskAgendaRow key={t.id} task={t} onTap={openTask} dateFormat="time" />)}
              </div>
            ))}
            {(unscheduledNotes.length > 0 || unscheduledTasks.length > 0) && (
              <div>
                <div style={{
                  position: "sticky", top: 0, zIndex: 2, background: "var(--bg)",
                  padding: "8px 20px", fontSize: 12, fontWeight: 800, color: "var(--ink-soft)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  Unscheduled
                </div>
                {unscheduledNotes.map((n) => <NoteListItem key={n.id} note={n} onTap={openNote} />)}
                {unscheduledTasks.map((t) => <TaskAgendaRow key={t.id} task={t} onTap={openTask} />)}
              </div>
            )}
          </>
        )}

        {!isEmpty && viewMode === "all" && allFeed.map((e) =>
          e.note
            ? <NoteListItem key={e.key} note={e.note} onTap={openNote} dateFormat="full" />
            : <TaskAgendaRow key={e.key} task={e.task!} onTap={openTask} dateFormat="full" />
        )}
      </div>

      <NoteEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} note={editing} />
      {fullEditorOpen && (
        <Suspense fallback={null}>
          {/* key forces a remount (fresh editor instance) when the Command
              Palette jumps from one open note straight to another, since
              Tiptap's useEditor/noteIdRef only read `note` on mount. */}
          <NoteFullEditor key={editing?.id ?? "new"} note={editing} onClose={() => setFullEditorOpen(false)} />
        </Suspense>
      )}
      <TaskDetailSheet open={taskDetailOpen} onClose={() => setTaskDetailOpen(false)} task={editingTask} lists={taskLists} tags={taskTags} />
    </div>
  );
}
