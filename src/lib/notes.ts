import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { NoteDto, NoteKind } from "../db/types";
import { getDeviceId } from "./deviceId";

export interface NewNoteInput {
  kind: NoteKind;
  title: string;
  rawText: string;
  description?: string;
  body?: string;
  dueDate?: string;
  allDay?: boolean;
  location?: string;
  links?: string[];
}

export async function createNote(input: NewNoteInput): Promise<number> {
  const now = Date.now();
  return db.notes.add({
    ownerId: getDeviceId(),
    kind: input.kind,
    title: input.title,
    rawText: input.rawText,
    description: input.description,
    body: input.body,
    dueDate: input.dueDate,
    allDay: input.allDay,
    location: input.location,
    links: input.links,
    completed: input.kind === "task" || input.kind === "reminder" ? false : undefined,
    createdAt: now,
    updatedAt: now,
  } as NoteDto);
}

// Tiptap HTML -> plain text, for the note-list preview snippet and for
// deriving `title` (the body's first non-empty line) — the full-screen
// editor has no separate title input, matching Apple Notes.
export function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

// First line only, for the list-row/gallery title.
export function htmlToTitle(html: string, maxLen = 80): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const firstBlock = div.querySelector("h1, h2, h3, p, li");
  const line = (firstBlock?.textContent ?? div.textContent ?? "").replace(/\s+/g, " ").trim();
  return line.length > maxLen ? line.slice(0, maxLen) + "…" : line;
}

export async function updateNote(id: number, patch: Partial<NoteDto>): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteNote(id: number): Promise<void> {
  await db.notes.delete(id);
}

export async function toggleTaskComplete(id: number, completed: boolean): Promise<void> {
  await db.notes.update(id, { completed, completedAt: completed ? Date.now() : undefined, updatedAt: Date.now() });
}

// Every note/task/reminder, newest first — the "All" feed in NotesPage.
// Optionally filtered to a single kind (the composer's filter chip row).
export function useNotes(kind?: NoteKind): NoteDto[] {
  return (
    useLiveQuery(async () => {
      const all = kind ? await db.notes.where("kind").equals(kind).toArray() : await db.notes.toArray();
      return all.sort((a, b) => b.createdAt - a.createdAt);
    }, [kind]) ?? []
  );
}

// Dated tasks/reminders whose dueDate falls on `date` (YYYY-MM-DD) — one
// day's worth, used by NotesPage's Timeline day groups. dueDate is optional
// (plain notes never set it), so — like isRoutine/isFoodSlot elsewhere in
// this codebase — filtering happens in memory off .toArray() rather than an
// index range query; fine at this app's scale.
export function useNotesForDate(date: string): NoteDto[] {
  return useLiveQuery(async () => (await db.notes.toArray()).filter((n) => n.dueDate?.slice(0, 10) === date), [date]) ?? [];
}

// Dated tasks/reminders within [rangeStart, rangeEnd] (both YYYY-MM-DD,
// inclusive) — feeds Calendar's Agenda/Month overlay.
export function useNotesForRange(rangeStart: string, rangeEnd: string): NoteDto[] {
  return (
    useLiveQuery(async () => {
      const all = await db.notes.toArray();
      return all.filter((n) => {
        if (!n.dueDate) return false;
        const d = n.dueDate.slice(0, 10);
        return d >= rangeStart && d <= rangeEnd;
      });
    }, [rangeStart, rangeEnd]) ?? []
  );
}

// Every not-yet-completed dated task/reminder, soonest first — powers the
// "Upcoming" section of Timeline and the due/overdue banner surfaced on open.
export function useUpcomingNotes(): NoteDto[] {
  return (
    useLiveQuery(async () => {
      const all = await db.notes.toArray();
      return all.filter((n) => n.dueDate && !n.completed).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    }, []) ?? []
  );
}
