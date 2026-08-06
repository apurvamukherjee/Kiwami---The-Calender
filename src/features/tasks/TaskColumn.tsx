import { useEffect, useRef, useState } from "react";
import { Input, Button } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TbPlus, TbListCheck } from "react-icons/tb";
import { createTask } from "../../lib/tasks";
import { parseNoteText } from "../../lib/parseNoteText";
import { useTokens } from "../../hooks/useTokens";
import { TaskCard } from "./TaskCard";
import { listDndId, taskDndId } from "./taskDnd";
import type { TaskDto, TaskListDto, TaskTagDto } from "../../db/types";

interface Props {
  list: TaskListDto;
  taskIds: number[];
  tasksById: Map<number, TaskDto>;
  tags: TaskTagDto[];
  onOpenTask: (id: number) => void;
  dragActive: boolean;
}

export function TaskColumn({ list, taskIds, tasksById, tags, onOpenTask, dragActive }: Props) {
  const tokens = useTokens();
  const { setNodeRef, isOver } = useDroppable({ id: listDndId(list.id!) });
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [cleared, setCleared] = useState(false);
  const prevActiveCount = useRef<number | null>(null);

  const activeCount = taskIds.reduce((n, id) => {
    const t = tasksById.get(id);
    return t && !t.completed && !t.wontDo ? n + 1 : n;
  }, 0);

  // Milestone "list cleared" moment (F4): fires exactly once on the >0 -> 0
  // transition, not on every render at 0 (e.g. an empty list on first load),
  // and not on a plain reorder/filter that leaves the count unchanged.
  useEffect(() => {
    if (prevActiveCount.current != null && prevActiveCount.current > 0 && activeCount === 0) {
      setCleared(true);
      const t = setTimeout(() => setCleared(false), 1000);
      return () => clearTimeout(t);
    }
    prevActiveCount.current = activeCount;
  }, [activeCount]);

  async function submitAdd() {
    // Same NLP date parsing the main composer already uses (parseNoteText,
    // chrono-node, fully offline) — closes the gap where this quick-add was
    // plain-text-only.
    const parsed = parseNoteText(addText);
    const title = parsed.title.trim();
    if (!title) {
      setAddOpen(false);
      return;
    }
    await createTask({ listId: list.id!, title, dueDate: parsed.dueDate, allDay: parsed.allDay });
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
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0, overflow: "hidden" }}>
        <AnimatePresence>
          {cleared && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0.55 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: `radial-gradient(circle, ${tokens.emberHot}, ${tokens.accent})`,
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: list.color ?? "var(--ink-soft)", flexShrink: 0, position: "relative" }} />
        <span style={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", position: "relative" }}>
          {list.name}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", fontFamily: "var(--font-mono)", position: "relative" }}>{taskIds.length}</span>
        <Button type="text" size="small" icon={<TbPlus size={14} />} onClick={() => setAddOpen((v) => !v)} aria-label={`Add task to ${list.name}`} style={{ position: "relative" }} />
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
          {taskIds.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--ink-soft)", padding: "28px 0" }}>
              <TbListCheck size={20} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: 12 }}>No tasks</span>
            </div>
          )}
          {taskIds.map((id) => {
            const task = tasksById.get(id);
            if (!task) return null;
            return <TaskCard key={id} task={task} tags={tags} onOpen={() => onOpenTask(id)} dragActive={dragActive} />;
          })}
        </SortableContext>
      </div>
    </div>
  );
}
