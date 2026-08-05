import type { CSSProperties } from "react";
import dayjs from "dayjs";
import { Checkbox } from "antd";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbListCheck, TbRepeat } from "react-icons/tb";
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
  const priorityColor = tokens[PRIORITY_TOKEN_KEY[task.priority]];
  const taskTags = task.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TaskTagDto => !!t);
  const subtaskDone = task.subtasks.filter((s) => s.done).length;
  const overdue = !!task.dueDate && !task.completed && dayjs(task.dueDate).isBefore(dayjs(), "day");
  const hasMeta = taskTags.length > 0 || task.subtasks.length > 0 || !!task.recurrence || !!task.dueDate;

  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: 10,
        padding: "8px 10px",
        opacity: task.completed ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* A plain wrapper (not a prop on Checkbox — antd's CheckboxProps doesn't
            expose onPointerDown) stops the pointerdown here so dnd-kit's drag sensor
            never arms from a checkbox tap. */}
        <span onPointerDown={(e) => e.stopPropagation()} style={{ marginTop: 1, display: "flex" }}>
          <Checkbox
            checked={!!task.completed}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              hapticLight();
              void completeTask(task.id!, e.target.checked);
            }}
          />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              textDecoration: task.completed ? "line-through" : "none",
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
