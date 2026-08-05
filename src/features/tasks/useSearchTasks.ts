import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import type { TaskDto, TaskListDto } from "../../db/types";

const MAX_RESULTS = 20;

export interface TaskSearchResult {
  task: TaskDto;
  list?: TaskListDto;
}

// Title-substring search over non-archived tasks, feeding the Command Palette
// alongside useSearchEvents.ts (same feature-folder convention). Completed-but-not-
// archived tasks still surface, matching useNotes' behavior for completed notes.
export function useSearchTasks(query: string): TaskSearchResult[] {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const lists = useLiveQuery(() => db.taskLists.toArray(), []) ?? [];
  const listsById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tasks
      .filter((t) => !t.archived && t.title.toLowerCase().includes(q))
      .sort((a, b) => (a.dueDate ?? "￿").localeCompare(b.dueDate ?? "￿"))
      .slice(0, MAX_RESULTS)
      .map((task) => ({ task, list: listsById.get(task.listId) }));
  }, [tasks, listsById, query]);
}
