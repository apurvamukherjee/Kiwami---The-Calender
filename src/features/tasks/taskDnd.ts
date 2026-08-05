// @dnd-kit ids share one flat namespace across every draggable/droppable — task ids
// and list ids are both independent Dexie auto-increment counters, so `task 1` and
// `list 1` would otherwise collide. Prefixing disambiguates them.
export const listDndId = (listId: number): string => `list-${listId}`;
export const taskDndId = (taskId: number): string => `task-${taskId}`;

export function parseDndId(id: string | number): { kind: "list" | "task"; id: number } | null {
  const s = String(id);
  if (s.startsWith("list-")) return { kind: "list", id: Number(s.slice(5)) };
  if (s.startsWith("task-")) return { kind: "task", id: Number(s.slice(5)) };
  return null;
}
