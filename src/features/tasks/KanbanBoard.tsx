import { useCallback, useEffect, useRef, useState } from "react";
import { TbChevronRight } from "react-icons/tb";
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
import { reorderBoard, taskMatchesFilter, type TaskScopeFilter } from "../../lib/tasks";
import { todayKey } from "../../lib/date.utils";
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
  scope: TaskScopeFilter;
  hideCompleted: boolean;
}

export function KanbanBoard({ lists, grouped, tasksById, tags, onOpenTask, scope, hideCompleted }: Props) {
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

  // Threaded down to TaskCard so its FLIP layout animation (framer-motion's
  // `layout` prop) can disable itself for every card the instant ANY drag
  // starts, not just the one being dragged — dnd-kit writes a `transform`
  // style to every sortable item while a drag is in progress (to preview
  // the reflow), and letting framer's own layout-driven transform run at
  // the same time on those same elements would fight it.
  const dragActive = activeId !== null;

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      {isDesktop ? (
        <DesktopBoard lists={lists} columns={columns} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} dragActive={dragActive} scope={scope} hideCompleted={hideCompleted} />
      ) : (
        <MobileBoard lists={lists} columns={columns} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} dragActive={dragActive} scope={scope} hideCompleted={hideCompleted} />
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
  dragActive: boolean;
  scope: TaskScopeFilter;
  hideCompleted: boolean;
}

function visibleCount(ids: number[], tasksById: Map<number, TaskDto>, scope: TaskScopeFilter, hideCompleted: boolean, today: string): number {
  let n = 0;
  for (const id of ids) {
    const t = tasksById.get(id);
    if (t && taskMatchesFilter(t, scope, hideCompleted, today)) n++;
  }
  return n;
}

function DesktopBoard({ lists, columns, tasksById, tags, onOpenTask, dragActive, scope, hideCompleted }: BoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lists.length]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div ref={scrollRef} style={{ display: "flex", gap: 12, padding: 12, height: "100%", overflowX: "auto" }}>
        {lists.map((list) => (
          <div key={list.id} style={{ width: 300, flexShrink: 0, height: "100%" }}>
            <TaskColumn list={list} taskIds={columns[list.id!] ?? []} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} dragActive={dragActive} scope={scope} hideCompleted={hideCompleted} />
          </div>
        ))}
      </div>
      {/* Board-overflow hint (Part A.7) — a right-edge fade + chevron signaling
          more columns are scrollable, since a bare overflow-x:auto has no
          visual cue on its own once the board grows past ~5 lists. */}
      {overflowing && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 40, pointerEvents: "none",
          background: "linear-gradient(to right, transparent, var(--bg) 85%)",
          display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4,
        }}>
          <TbChevronRight size={16} style={{ color: "var(--ink-soft)" }} />
        </div>
      )}
    </div>
  );
}

// Single-column-fills-viewport + native scroll-snap swipe, backed by a synced header
// tab strip — deliberately NOT a horizontally-scrolling multi-column board (the
// documented #1 Trello-mobile complaint). Card drag is a physically separate gesture
// channel from this scroll (see KanbanBoard's TouchSensor delay), so a fast flick
// scrolls between columns while a press-and-hold on a card picks it up.
function MobileBoard({ lists, columns, tasksById, tags, onOpenTask, dragActive, scope, hideCompleted }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const today = todayKey();

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
        {lists.map((list, i) => {
          // Tint each pill with its own list color rather than the flat
          // accent (Part A.8) — stronger at-a-glance differentiation while
          // swiping between columns.
          const tint = list.color ?? "var(--accent)";
          return (
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
              border: `1px solid ${i === activeIdx ? tint : "var(--border)"}`,
              background: i === activeIdx ? tint : "transparent",
              color: i === activeIdx ? "#fff" : "var(--ink)",
            }}
          >
            {list.name} <span style={{ opacity: 0.75 }}>{visibleCount(columns[list.id!] ?? [], tasksById, scope, hideCompleted, today)}</span>
          </button>
          );
        })}
      </div>
      <div ref={containerRef} onScroll={onScroll} style={{ display: "flex", flex: 1, minHeight: 0, overflowX: "auto", scrollSnapType: "x mandatory" }}>
        {lists.map((list) => (
          <div key={list.id} style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0, height: "100%", padding: 8 }}>
            <TaskColumn list={list} taskIds={columns[list.id!] ?? []} tasksById={tasksById} tags={tags} onOpenTask={onOpenTask} dragActive={dragActive} scope={scope} hideCompleted={hideCompleted} />
          </div>
        ))}
      </div>
    </div>
  );
}
