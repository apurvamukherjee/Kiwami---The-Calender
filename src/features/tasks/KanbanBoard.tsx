import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { useIsMobile } from "../../hooks/useIsMobile";
import { reorderBoard } from "../../lib/tasks";
import { TaskColumn } from "./TaskColumn";
import { TaskCardOverlay } from "./TaskCard";
import { parseDndId } from "./taskDnd";
import type { TaskDto, TaskListDto, TaskTagDto } from "../../db/types";

// Board switches from single-column-with-swipe (mobile — fixes Trello mobile's
// "you can only see one column at a time" complaint) to a traditional multi-column
// row at this width, independent of the app's default 640px mobile breakpoint used
// for toolbar/Sheet responsiveness elsewhere.
const DESKTOP_BREAKPOINT = 1440;

interface Props {
  lists: TaskListDto[];
  grouped: Map<number, TaskDto[]>;
  tasksById: Map<number, TaskDto>;
  tags: TaskTagDto[];
  onOpenTask: (id: number) => void;
}

export function KanbanBoard({ lists, grouped, tasksById, tags, onOpenTask }: Props) {
  // useIsMobile's query is `max-width: ${breakpoint}px` (inclusive) — passing
  // DESKTOP_BREAKPOINT directly would make a viewport at exactly 1440px match
  // "mobile" and render the single-column board instead of the intended
  // multi-column desktop layout at that width.
  const isDesktop = !useIsMobile(DESKTOP_BREAKPOINT - 1);
  const [columns, setColumns] = useState<Record<number, number[]>>({});
  const [activeId, setActiveId] = useState<number | null>(null);

  // Resync the local drag-preview state from the live Dexie query, but only while not
  // mid-drag — otherwise a live-query update (e.g. another tab completing a task)
  // would yank a card out from under the user's pointer.
  useEffect(() => {
    if (activeId !== null) return;
    const next: Record<number, number[]> = {};
    for (const list of lists) {
      if (list.id == null) continue;
      next[list.id] = (grouped.get(list.id) ?? []).map((t) => t.id!);
    }
    setColumns(next);
  }, [lists, grouped, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // closestCenter alone picks unreliable targets for a large/empty droppable zone —
  // an empty column's rect fills the whole column height, so its *center* can be far
  // from the pointer even while the pointer is clearly hovering inside it (confirmed
  // by manual testing: dragging into an empty column intermittently registered as a
  // same-column reorder instead). pointerWithin checks literal pointer-in-rect
  // containment first (dnd-kit's own documented fix for this exact case), falling
  // back to rectIntersection only if the pointer isn't strictly inside anything.
  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  }, []);

  function findColumnOf(taskId: number): number | undefined {
    for (const [listId, ids] of Object.entries(columns)) {
      if (ids.includes(taskId)) return Number(listId);
    }
    return undefined;
  }

  function onDragStart(e: DragStartEvent) {
    const parsed = parseDndId(e.active.id);
    if (parsed?.kind === "task") setActiveId(parsed.id);
  }

  // Live cross-column preview — dnd-kit's standard "multiple containers" recipe:
  // mutate the local columns map as the pointer moves so the board visually reflects
  // the move before drop, then onDragEnd commits whatever state this settled into.
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeParsed = parseDndId(active.id);
    const overParsed = parseDndId(over.id);
    if (!activeParsed || activeParsed.kind !== "task" || !overParsed) return;

    const activeTaskId = activeParsed.id;
    const fromListId = findColumnOf(activeTaskId);
    const toListId = overParsed.kind === "list" ? overParsed.id : findColumnOf(overParsed.id);
    if (fromListId === undefined || toListId === undefined || fromListId === toListId) return;

    setColumns((prev) => {
      const fromIds = (prev[fromListId] ?? []).filter((id) => id !== activeTaskId);
      const toIds = [...(prev[toListId] ?? [])];
      const overIndex = overParsed.kind === "task" ? toIds.indexOf(overParsed.id) : toIds.length;
      toIds.splice(overIndex === -1 ? toIds.length : overIndex, 0, activeTaskId);
      return { ...prev, [fromListId]: fromIds, [toListId]: toIds };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const activeParsed = parseDndId(active.id);
    if (!activeParsed || activeParsed.kind !== "task") return;
    const activeTaskId = activeParsed.id;
    const listId = findColumnOf(activeTaskId);
    if (listId === undefined) return;

    let finalColumns = columns;
    const overParsed = over ? parseDndId(over.id) : null;
    if (overParsed?.kind === "task" && overParsed.id !== activeTaskId) {
      const ids = columns[listId] ?? [];
      const oldIndex = ids.indexOf(activeTaskId);
      const overIndex = ids.indexOf(overParsed.id);
      if (oldIndex !== -1 && overIndex !== -1) {
        finalColumns = { ...columns, [listId]: arrayMove(ids, oldIndex, overIndex) };
        setColumns(finalColumns);
      }
    }
    void reorderBoard(Object.entries(finalColumns).map(([lid, taskIds]) => ({ listId: Number(lid), taskIds })));
  }

  const activeTask = activeId != null ? tasksById.get(activeId) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      {isDesktop ? (
        <DesktopBoard lists={lists} columns={columns} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} />
      ) : (
        <MobileBoard lists={lists} columns={columns} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} />
      )}
      <DragOverlay>{activeTask ? <TaskCardOverlay task={activeTask} tags={tags} /> : null}</DragOverlay>
    </DndContext>
  );
}

interface BoardProps {
  lists: TaskListDto[];
  columns: Record<number, number[]>;
  tasksById: Map<number, TaskDto>;
  tags: TaskTagDto[];
  onOpenTask: (id: number) => void;
}

function DesktopBoard({ lists, columns, tasksById, tags, onOpenTask }: BoardProps) {
  return (
    <div style={{ display: "flex", gap: 12, padding: 12, height: "100%", overflowX: "auto" }}>
      {lists.map((list) => (
        <div key={list.id} style={{ width: 300, flexShrink: 0, height: "100%" }}>
          <TaskColumn list={list} taskIds={columns[list.id!] ?? []} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} />
        </div>
      ))}
    </div>
  );
}

// Single-column-fills-viewport + native scroll-snap swipe, backed by a synced header
// tab strip — deliberately NOT a horizontally-scrolling multi-column board (the
// documented #1 Trello-mobile complaint). Card drag is a physically separate gesture
// channel from this scroll (see KanbanBoard's TouchSensor delay), so a fast flick
// scrolls between columns while a press-and-hold on a card picks it up.
function MobileBoard({ lists, columns, tasksById, tags, onOpenTask }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  function scrollToIndex(i: number) {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", borderBottom: "1px solid var(--border)" }}>
        {lists.map((list, i) => (
          <button
            key={list.id}
            onClick={() => scrollToIndex(i)}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
              cursor: "pointer",
              border: `1px solid ${i === activeIdx ? "var(--accent)" : "var(--border)"}`,
              background: i === activeIdx ? "var(--accent)" : "transparent",
              color: i === activeIdx ? "#fff" : "var(--ink)",
            }}
          >
            {list.name} <span style={{ opacity: 0.75 }}>{(columns[list.id!] ?? []).length}</span>
          </button>
        ))}
      </div>
      <div ref={containerRef} onScroll={onScroll} style={{ display: "flex", flex: 1, minHeight: 0, overflowX: "auto", scrollSnapType: "x mandatory" }}>
        {lists.map((list) => (
          <div key={list.id} style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0, height: "100%", padding: 8 }}>
            <TaskColumn list={list} taskIds={columns[list.id!] ?? []} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} />
          </div>
        ))}
      </div>
    </div>
  );
}
