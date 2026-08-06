import Dexie, { type Table } from "dexie";
import { TOKENS } from "../theme";
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
    // v4: retires `notes` rows with kind:"task" as their own concept — the Tasks/
    // Kanban board (v3) is now the single source of truth for tasks everywhere
    // (Kanban board, Notes page's "Task" filter, Calendar overlay). Same stores as
    // v3 (no shape change); the upgrade folds every existing kind:"task" note into
    // a real TaskDto — seeding the same 3 starter lists ensureDefaultTaskLists()
    // would, if none exist yet — and removes it from `notes`.
    this.version(4).stores({
      events: "++id, ownerId, startTime",
      recurrenceRules: "++id, &eventId",
      occurrenceStatus: "++id, eventId, occurrenceDate, &[eventId+occurrenceDate]",
      settings: "&key",
      notes: "++id, ownerId, kind, dueDate",
      taskLists: "++id, ownerId, order",
      tasks: "++id, ownerId, listId, completed, archived, dueDate, *tagIds",
      taskTags: "++id, ownerId, name",
    }).upgrade(async (trans) => {
      const notesTable = trans.table<NoteDto, number>("notes");
      const taskNotes = await notesTable.where("kind").equals("task").toArray();
      if (taskNotes.length === 0) return;

      const listsTable = trans.table<TaskListDto, number>("taskLists");
      const tasksTable = trans.table<TaskDto, number>("tasks");
      const now = Date.now();

      let lists = await listsTable.toArray();
      if (lists.length === 0) {
        const ownerId = taskNotes[0].ownerId;
        await listsTable.bulkAdd([
          { ownerId, name: "To Do", color: TOKENS.dark.accent, order: 0, createdAt: now, updatedAt: now },
          { ownerId, name: "In Progress", color: TOKENS.dark.gold, order: 1, createdAt: now, updatedAt: now },
          { ownerId, name: "Done", color: TOKENS.dark.teal, order: 2, createdAt: now, updatedAt: now },
        ]);
        lists = await listsTable.toArray();
      }
      const defaultListId = lists.sort((a, b) => a.order - b.order)[0].id!;
      const siblings = await tasksTable.where("listId").equals(defaultListId).toArray();
      let order = siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1;

      for (const note of taskNotes) {
        await tasksTable.add({
          ownerId: note.ownerId,
          listId: defaultListId,
          title: note.title,
          description: note.description,
          order: order++,
          priority: "none",
          tagIds: [],
          subtasks: [],
          dueDate: note.dueDate,
          allDay: note.allDay,
          completed: !!note.completed,
          completedAt: note.completedAt,
          archived: false,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        } as TaskDto);
        await notesTable.delete(note.id!);
      }
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
