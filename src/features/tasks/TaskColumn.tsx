import { useState } from "react";
import { Input, Button } from "antd";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TbPlus } from "react-icons/tb";
import { createTask } from "../../lib/tasks";
import { TaskCard } from "./TaskCard";
import { listDndId, taskDndId } from "./taskDnd";
import type { TaskDto, TaskListDto, TaskTagDto } from "../../db/types";

interface Props {
  list: TaskListDto;
  taskIds: number[];
  tasksById: Map<number, TaskDto>;
  tags: TaskTagDto[];
  onOpenTask: (id: number) => void;
}

export function TaskColumn({ list, taskIds, tasksById, tags, onOpenTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: listDndId(list.id!) });
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");

  async function submitAdd() {
    const title = addText.trim();
    if (!title) {
      setAddOpen(false);
      return;
    }
    await createTask({ listId: list.id!, title });
    setAddText("");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: list.color ?? "var(--ink-soft)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {list.name}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>{taskIds.length}</span>
        <Button type="text" size="small" icon={<TbPlus size={14} />} onClick={() => setAddOpen((v) => !v)} aria-label={`Add task to ${list.name}`} />
      </div>

      {addOpen && (
        <div style={{ padding: 8, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <Input
            size="small"
            autoFocus
            placeholder="Task title"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onPressEnter={() => void submitAdd()}
            onBlur={() => { if (!addText.trim()) setAddOpen(false); }}
          />
        </div>
      )}

      <div ref={setNodeRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 8, background: isOver ? "var(--border)" : "transparent" }}>
        <SortableContext items={taskIds.map(taskDndId)} strategy={verticalListSortingStrategy}>
          {taskIds.length === 0 && <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", padding: "24px 0" }}>No tasks</div>}
          {taskIds.map((id) => {
            const task = tasksById.get(id);
            if (!task) return null;
            return <TaskCard key={id} task={task} tags={tags} onOpen={() => onOpenTask(id)} />;
          })}
        </SortableContext>
      </div>
    </div>
  );
}
