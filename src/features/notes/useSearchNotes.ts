import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { htmlToPlainText } from "../../lib/notes";
import { scoreMatch } from "../../lib/searchScore";
import type { NoteDto } from "../../db/types";

const MAX_RESULTS = 20;

export interface NoteSearchResult {
  note: NoteDto;
}

// Fuzzy search (scoreMatch) over every note/task/reminder row, matching
// title + rawText + description (reminders) + the rich body's plain text
// (kind "note" only). Feeds the Command Palette alongside
// useSearchEvents.ts/useSearchTasks.ts.
//
// htmlToPlainText does real DOM work (a detached <div> + innerHTML parse) —
// cheap for the handful of *visible* rows it was originally built for
// (NoteListItem), but not for every note in the table on every keystroke.
// `enabled` (the palette's own `open`) gates both the live query and the
// parse: CommandPalette is always-mounted, and NoteFullEditor autosaves to
// db.notes every ~600ms while composing, so without this gate every autosave
// tick would re-parse every other note's HTML in the background even while
// the palette is closed and the result is unused.
export function useSearchNotes(query: string, enabled: boolean): NoteSearchResult[] {
  const notes = useLiveQuery(() => (enabled ? db.notes.toArray() : []), [enabled]) ?? [];

  const plainTextById = useMemo(() => {
    const map = new Map<number, string>();
    if (!enabled) return map;
    for (const n of notes) {
      if (n.kind === "note" && n.body && n.id != null) map.set(n.id, htmlToPlainText(n.body));
    }
    return map;
  }, [notes, enabled]);

  return useMemo(() => {
    if (!query.trim()) return [];

    const scored: { note: NoteDto; score: number }[] = [];
    for (const note of notes) {
      const candidates = [note.title, note.rawText, note.description, note.id != null ? plainTextById.get(note.id) : undefined];
      let best: number | null = null;
      for (const text of candidates) {
        if (!text) continue;
        const s = scoreMatch(query, text);
        if (s != null && (best == null || s > best)) best = s;
      }
      if (best != null) scored.push({ note, score: best });
    }

    return scored
      .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)
      .slice(0, MAX_RESULTS)
      .map(({ note }) => ({ note }));
  }, [notes, plainTextById, query]);
}
