import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { scoreMatch } from "../../lib/searchScore";
import type { TaskDto, TaskListDto } from "../../db/types";

const MAX_RESULTS = 20;

export interface TaskSearchResult {
  task: TaskDto;
  list?: TaskListDto;
}

// Best score across title/description, or null if neither matches.
function scoreTask(query: string, t: TaskDto): number | null {
  const titleScore = scoreMatch(query, t.title);
  const descScore = t.description != null ? scoreMatch(query, t.description) : null;
  if (titleScore == null) return descScore;
  if (descScore == null) return titleScore;
  return Math.max(titleScore, descScore);
}

// Fuzzy title+description search (scoreMatch) over non-archived tasks,
// feeding the Command Palette alongside useSearchEvents.ts/useSearchNotes.ts
// (same feature-folder convention). Completed-but-not-archived tasks still
// surface, matching useNotes' behavior for completed notes. Final display
// order stays due-date-ascending — "soonest due" is a stronger signal than
// "best text match" once several tasks match a rough query — but candidates
// are ranked by score *before* the MAX_RESULTS cap, so a strong match can't
// be crowded out by weaker fuzzy matches that merely happen to be due sooner.
export function useSearchTasks(query: string): TaskSearchResult[] {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const lists = useLiveQuery(() => db.taskLists.toArray(), []) ?? [];
  const listsById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  return useMemo(() => {
    if (!query.trim()) return [];
    const scored: { task: TaskDto; score: number }[] = [];
    for (const t of tasks) {
      if (t.archived || t.wontDo) continue;
      const score = scoreTask(query, t);
      if (score != null) scored.push({ task: t, score });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .sort((a, b) => (a.task.dueDate ?? "￿").localeCompare(b.task.dueDate ?? "￿"))
      .map(({ task }) => ({ task, list: listsById.get(task.listId) }));
  }, [tasks, listsById, query]);
}
