import { type CSSProperties, useState } from "react";
import dayjs from "dayjs";
import { Checkbox } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbListCheck, TbRepeat, TbGripVertical, TbBan } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { completeTask, PRIORITY_TOKEN_KEY } from "../../lib/tasks";
import { hapticLight } from "../../lib/haptics";
import { taskDndId } from "./taskDnd";
import type { TaskDto, TaskTagDto } from "../../db/types";

interface BodyProps {
  task: TaskDto;
  tags: TaskTagDto[];
}

// Shared visual rendering between the sortable in-column card and the DragOverlay
// ghost copy — the overlay must NOT call useSortable itself (it's a floating visual
// duplicate, not a second draggable registration for the same id).
function TaskCardBody({ task, tags }: BodyProps) {
  const tokens = useTokens();
  const [burst, setBurst] = useState(false);
  const priorityColor = tokens[PRIORITY_TOKEN_KEY[task.priority]];
  const taskTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TaskTagDto => !!t);
  const subtaskDone = task.subtasks.filter((s) => s.done).length;
  const overdue = !!task.dueDate && !task.completed && dayjs(task.dueDate).isBefore(dayjs(), "day");
  const hasMeta = taskTags.length > 0 || task.subtasks.length > 0 || !!task.recurrence || !!task.dueDate;
  const dimmed = task.completed || task.wontDo;

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
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      {/* Visual-only drag affordance — the whole card is still the drag
          surface (see TaskCard's {...listeners} below); this just signals
          that fact, since the card had no such cue before. */}
      <TbGripVertical size={14} style={{ position: "absolute", top: 6, right: 6, color: "var(--ink-soft)", opacity: 0.4, cursor: "grab" }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* A plain wrapper (not a prop on Checkbox — antd's CheckboxProps doesn't
            expose onPointerDown) stops the pointerdown here so dnd-kit's drag sensor
            never arms from a checkbox tap. */}
        <span onPointerDown={(e) => e.stopPropagation()} style={{ marginTop: 1, display: "flex", position: "relative" }}>
          {task.wontDo ? (
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
        </div>
      </div>
    </div>
  );
}

interface CardProps extends BodyProps {
  onOpen: () => void;
}

export function TaskCard({ task, tags, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: taskDndId(task.id!) });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    marginBottom: 8,
    cursor: "pointer",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => { if (!isDragging) onOpen(); }}>
      <TaskCardBody task={task} tags={tags} />
    </div>
  );
}

export function TaskCardOverlay({ task, tags }: BodyProps) {
  return (
    <div style={{ boxShadow: "0 12px 28px rgba(0,0,0,0.28)", cursor: "grabbing", borderRadius: 10 }}>
      <TaskCardBody task={task} tags={tags} />
    </div>
  );
}
