import { useMemo, useState, lazy, Suspense } from "react";
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
import { todayKey } from "../../lib/date.utils";
import type { NoteDto, NoteKind } from "../../db/types";

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
}

// Notes/Tasks/Reminders shell, mirroring CalendarPage.tsx's structure
// (toolbar + view body). NoteComposer stays pinned above the list so
// quick-capture never requires navigating away from whatever you're
// currently browsing.
export function NotesPage({ section, onChangeSection }: Props) {
  const isMobile = useIsMobile();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [editing, setEditing] = useState<NoteDto | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [fullEditorOpen, setFullEditorOpen] = useState(false);

  const notes = useNotes(kindFilter === "all" ? undefined : kindFilter);
  const today = todayKey();

  // Dated entries grouped by day (Timeline) + a trailing "Unscheduled" group
  // for notes/tasks with no dueDate — same day-grouping shape AgendaView.tsx
  // already uses for the calendar.
  const { groups, unscheduled } = useMemo(() => {
    const dated = [...notes].filter((n) => n.dueDate).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    const map = new Map<string, NoteDto[]>();
    for (const n of dated) {
      const key = n.dueDate!.slice(0, 10);
      const arr = map.get(key);
      if (arr) arr.push(n);
      else map.set(key, [n]);
    }
    return {
      groups: [...map.entries()].sort(([a], [b]) => a.localeCompare(b)),
      unscheduled: notes.filter((n) => !n.dueDate),
    };
  }, [notes]);

  // Notes open in the full-screen rich editor (Apple Notes-style); Tasks/
  // Reminders keep the compact NoteEditorSheet — rich text/full-screen
  // doesn't suit a quick-glance due-date item.
  function openNote(n: NoteDto) {
    setEditing(n);
    if (n.kind === "note") setFullEditorOpen(true);
    else setEditorOpen(true);
  }

  const isEmpty = notes.length === 0;

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
            {groups.map(([date, dayNotes]) => (
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
              </div>
            ))}
            {unscheduled.length > 0 && (
              <div>
                <div style={{
                  position: "sticky", top: 0, zIndex: 2, background: "var(--bg)",
                  padding: "8px 20px", fontSize: 12, fontWeight: 800, color: "var(--ink-soft)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  Unscheduled
                </div>
                {unscheduled.map((n) => <NoteListItem key={n.id} note={n} onTap={openNote} />)}
              </div>
            )}
          </>
        )}

        {!isEmpty && viewMode === "all" && notes.map((n) => <NoteListItem key={n.id} note={n} onTap={openNote} dateFormat="full" />)}
      </div>

      <NoteEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} note={editing} />
      {fullEditorOpen && (
        <Suspense fallback={null}>
          <NoteFullEditor note={editing} onClose={() => setFullEditorOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
