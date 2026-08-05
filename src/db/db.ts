import Dexie, { type Table } from "dexie";
import type { EventDto, RecurrenceRuleDto, OccurrenceStatusDto, SettingDto, NoteDto, TaskDto, TaskListDto, TaskTagDto } from "./types";

class KiwamiDB extends Dexie {
  events!: Table<EventDto, number>;
  recurrenceRules!: Table<RecurrenceRuleDto, number>;
  occurrenceStatus!: Table<OccurrenceStatusDto, number>;
  settings!: Table<SettingDto, string>;
  notes!: Table<NoteDto, number>;
  taskLists!: Table<TaskListDto, number>;
  tasks!: Table<TaskDto, number>;
  taskTags!: Table<TaskTagDto, number>;

  constructor() {
    super("kiwami");
    // isRoutine/isFoodSlot are deliberately NOT indexed here: they're plain
    // booleans, and boolean isn't a valid IndexedDB key type — an index on
    // one would silently misbehave. Every read filters them in memory off
    // `.toArray()` instead (fine at this app's scale, matches how
    // useCalendarEvents already works).
    this.version(1).stores({
      events: "++id, ownerId, startTime",
      recurrenceRules: "++id, &eventId",
      occurrenceStatus: "++id, eventId, occurrenceDate, &[eventId+occurrenceDate]",
      settings: "&key",
    });
    // v2: adds `notes` (Notes/Tasks/Reminders). Purely additive — no
    // upgrade() needed since no existing table's shape changes. `kind` is a
    // string enum (not a boolean), so — unlike isRoutine/isFoodSlot above —
    // it's safe to index directly.
    this.version(2).stores({
      events: "++id, ownerId, startTime",
      recurrenceRules: "++id, &eventId",
      occurrenceStatus: "++id, eventId, occurrenceDate, &[eventId+occurrenceDate]",
      settings: "&key",
      notes: "++id, ownerId, kind, dueDate",
    });
    // v3: adds tasks/taskLists/taskTags (the Tasks/Kanban section). Purely additive —
    // no upgrade() needed, same convention as v1->v2. `*tagIds` is a Dexie multiEntry
    // index (array field), enabling fast tag-filter queries without a join table.
    this.version(3).stores({
      events: "++id, ownerId, startTime",
      recurrenceRules: "++id, &eventId",
      occurrenceStatus: "++id, eventId, occurrenceDate, &[eventId+occurrenceDate]",
      settings: "&key",
      notes: "++id, ownerId, kind, dueDate",
      taskLists: "++id, ownerId, order",
      tasks: "++id, ownerId, listId, completed, archived, dueDate, *tagIds",
      taskTags: "++id, ownerId, name",
    });
  }
}

export const db = new KiwamiDB();

export async function exportAll(): Promise<string> {
  const data: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString() };
  for (const t of db.tables) data[t.name] = await t.toArray();
  return JSON.stringify(data, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const d = JSON.parse(json);
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      if (Array.isArray(d[t.name])) await t.bulkAdd(d[t.name]);
    }
  });
}
