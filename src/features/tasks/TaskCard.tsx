import { useState } from "react";
import dayjs from "dayjs";
import { Checkbox } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbListCheck, TbRepeat, TbGripVertical, TbBan, TbBattery1, TbBattery2, TbBolt, TbClock, TbSquare, TbSquareCheckFilled } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { completeTask, PRIORITY_TOKEN_KEY } from "../../lib/tasks";
import { hapticLight } from "../../lib/haptics";
import { taskDndId } from "./taskDnd";
import type { TaskDto, TaskTagDto } from "../../db/types";

const ENERGY_ICON = { low: TbBattery1, medium: TbBattery2, high: TbBolt };

interface BodyProps {
  task: TaskDto;
  tags: TaskTagDto[];
  // Bulk-select mode (TasksPage's "Select" toggle, Part G) — while active,
  // the card's own complete-checkbox is replaced by a plain selection
  // checkbox and the whole card body becomes the select target instead of
  // opening the detail sheet. `selected`/`onToggleSelect` are only ever
  // both present or both absent, together with `selectMode`.
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

// Shared visual rendering between the sortable in-column card and the DragOverlay
// ghost copy — the overlay must NOT call useSortable itself (it's a floating visual
// duplicate, not a second draggable registration for the same id).
function TaskCardBody({ task, tags, selectMode, selected, onToggleSelect }: BodyProps) {
  const tokens = useTokens();
  const [burst, setBurst] = useState(false);
  const priorityColor = tokens[PRIORITY_TOKEN_KEY[task.priority]];
  const taskTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TaskTagDto => !!t);
  const subtaskDone = task.subtasks.filter((s) => s.done).length;
  const overdue = !!task.dueDate && !task.completed && dayjs(task.dueDate).isBefore(dayjs(), "day");
  const hasMeta = taskTags.length > 0 || task.subtasks.length > 0 || !!task.recurrence || !!task.dueDate || !!task.energy || !!task.estimatedMinutes;
  const dimmed = task.completed || task.wontDo;
  const EnergyIcon = task.energy ? ENERGY_ICON[task.energy] : null;

  return (
    <div
      style={{
        position: "relative",
        // Cold-ash wash echoes EmberChain's crater fill for a missed bead —
        // adapted for a rectangular card rather than reusing its circular
        // bead JSX directly.
        background: task.wontDo ? `${tokens.ash}14` : "var(--bg)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${task.wontDo ? tokens.ash : priorityColor}`,
        borderRadius: 10,
        padding: "8px 10px",
        opacity: dimmed && !selectMode ? 0.55 : 1,
        // A full ring via boxShadow, not a border-side rewrite — touching
        // individual border sides here would mean mixing the `border`
        // shorthand above with per-side longhand overrides in the same
        // style object, which React's dev mode warns about ("conflicting
        // property") the instant either value changes across a rerender.
        // boxShadow layers over the existing border cleanly instead.
        boxShadow: selectMode && selected ? "0 0 0 2px var(--accent)" : "none",
      }}
    >
      {/* Visual-only drag affordance — the whole card is still the drag
          surface (see TaskCard's {...listeners} below); this just signals
          that fact, since the card had no such cue before. Hidden in select
          mode, where the card isn't draggable (see TaskCard's dragActive gate). */}
      {!selectMode && (
        <TbGripVertical size={14} style={{ position: "absolute", top: 6, right: 6, color: "var(--ink-soft)", opacity: 0.4, cursor: "grab" }} />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* A plain wrapper (not a prop on Checkbox — antd's CheckboxProps doesn't
            expose onPointerDown) stops the pointerdown here so dnd-kit's drag sensor
            never arms from a checkbox tap. */}
        <span onPointerDown={(e) => e.stopPropagation()} style={{ marginTop: 1, display: "flex", position: "relative" }}>
          {selectMode ? (
            // Select mode replaces the complete-checkbox entirely — selecting
            // a task for a bulk action is a different decision than marking
            // it done, and offering both at once invites mis-taps.
            <Checkbox checked={!!selected} onClick={(e) => e.stopPropagation()} onChange={() => onToggleSelect?.()} />
          ) : task.wontDo ? (
            // Won't-do is only reopened from TaskDetailSheet (mirrors how
            // Archive is already sheet-only) — no checkbox interaction here.
            <TbBan size={15} style={{ color: tokens.ash }} />
          ) : (
            <Checkbox
              checked={!!task.completed}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                hapticLight();
                if (e.target.checked) {
                  setBurst(true);
                  setTimeout(() => setBurst(false), 650);
                }
                void completeTask(task.id!, e.target.checked);
              }}
            />
          )}
          <AnimatePresence>
            {burst && (
              <motion.div
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 2.6, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{
                  position: "absolute", inset: -3, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${tokens.emberHot}, ${tokens.accent})`,
                  pointerEvents: "none",
                }}
              />
            )}
          </AnimatePresence>
        </span>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              textDecoration: dimmed ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {task.title}
          </div>
          {hasMeta && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 }}>
              {taskTags.map((t) => (
                <span key={t.id} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: t.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color }} /> {t.name}
                </span>
              ))}
              {task.subtasks.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--ink-soft)" }}>
                  <TbListCheck size={11} /> {subtaskDone}/{task.subtasks.length}
                </span>
              )}
              {task.recurrence && <TbRepeat size={11} style={{ color: "var(--ink-soft)" }} />}
              {EnergyIcon && <EnergyIcon size={11} style={{ color: "var(--ink-soft)" }} />}
              {(task.estimatedMinutes || task.actualMinutes) && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>
                  <TbClock size={11} />
                  {task.actualMinutes ? `${task.actualMinutes}/${task.estimatedMinutes ?? "?"}m` : `${task.estimatedMinutes}m`}
                </span>
              )}
              {overdue && (
                <span className="label-caps" style={{ fontSize: 9, color: "var(--danger)" }}>Overdue</span>
              )}
              {task.dueDate && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: overdue ? "var(--danger)" : "var(--ink-soft)",
                  }}
                >
                  {task.allDay ? dayjs(task.dueDate).format("D MMM") : dayjs(task.dueDate).format("D MMM, HH:mm")}
                </span>
              )}
            </div>
          )}
          {/* The full checklist, not just the N/M count above — view-only here
              (tapping the card opens TaskDetailSheet, where each subtask is
              actually toggleable/reorderable); a card-level checkbox would
              fight dnd-kit's own drag-surface listeners on the card body. */}
          {task.subtasks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
              {task.subtasks.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, minWidth: 0 }}>
                  {s.done ? (
                    <TbSquareCheckFilled size={12} style={{ color: tokens.teal, flexShrink: 0 }} />
                  ) : (
                    <TbSquare size={12} style={{ color: "var(--ink-soft)", opacity: 0.6, flexShrink: 0 }} />
                  )}
                  <span style={{
                    color: s.done ? "var(--ink-soft)" : "var(--ink)",
                    textDecoration: s.done ? "line-through" : "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CardProps extends BodyProps {
  onOpen: () => void;
  // Threaded from KanbanBoard: true while ANY card in the board is being
  // dragged, not just this one. dnd-kit writes its own transform/transition
  // to every sortable item's style during a drag (to preview the reflow) —
  // framer-motion's `layout` prop must stay off for that whole window, or
  // the two positioning systems fight over the same `transform` in the same
  // frame. `layout` re-enables the instant the drag ends, so FLIP animation
  // still covers add/remove/reorder-by-filter (the mutations that don't go
  // through dnd-kit at all).
  dragActive: boolean;
}

export function TaskCard({ task, tags, onOpen, dragActive, selectMode, selected, onToggleSelect }: CardProps) {
  // Cards aren't draggable while select mode is active — dragging and
  // multi-selecting are two different gestures on the same tap-and-hold
  // surface, and letting both listen at once invites an accidental reorder
  // mid-selection. `disabled` fully turns off useSortable's own listeners.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: taskDndId(task.id!), disabled: selectMode });
  return (
    <motion.div
      ref={setNodeRef}
      layout={!dragActive}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        marginBottom: 8,
        cursor: "pointer",
      }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (isDragging) return;
        if (selectMode) onToggleSelect?.();
        else onOpen();
      }}
    >
      <TaskCardBody task={task} tags={tags} selectMode={selectMode} selected={selected} onToggleSelect={onToggleSelect} />
    </motion.div>
  );
}

// Part F #3 — a "picked up" scale cue + velocity-based tilt (`tilt`, degrees,
// fed live from KanbanBoard's onDragMove) layered on top of the existing
// static shadow, so the ghost copy reads as something physically lifted and
// carried rather than just a translucent duplicate sliding around flat.
export function TaskCardOverlay({ task, tags, tilt = 0 }: BodyProps & { tilt?: number }) {
  return (
    <div
      style={{
        boxShadow: "0 16px 32px rgba(0,0,0,0.32)",
        cursor: "grabbing",
        borderRadius: 10,
        transform: `scale(1.04) rotate(${tilt}deg)`,
        transition: "transform 120ms ease-out",
      }}
    >
      <TaskCardBody task={task} tags={tags} />
    </div>
  );
}
