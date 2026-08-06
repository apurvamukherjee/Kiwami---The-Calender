import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Button } from "antd";
import { TbArchive, TbListDetails, TbTags, TbFlame } from "react-icons/tb";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useTokens } from "../../hooks/useTokens";
import { SectionTabs } from "../../components/SectionTabs";
import type { Section } from "../../components/BottomNav";
import { TaskComposer } from "./TaskComposer";
import { KanbanBoard } from "./KanbanBoard";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { TaskListManager } from "./TaskListManager";
import { TaskTagManager } from "./TaskTagManager";
import { TaskArchiveView } from "./TaskArchiveView";
import { useTasks, useTaskLists, useTaskTags, ensureDefaultTaskLists, groupTasksByList } from "../../lib/tasks";
import type { TaskDto } from "../../db/types";

interface Props {
  section: Section;
  onChangeSection: (s: Section) => void;
  pendingTaskId?: number;
  onConsumePendingTaskId: () => void;
}

// Tasks section shell, mirroring NotesPage.tsx/CalendarPage.tsx's structure: sticky
// toolbar -> pinned TaskComposer -> the Kanban board filling the rest of the viewport.
export function TasksPage({ section, onChangeSection, pendingTaskId, onConsumePendingTaskId }: Props) {
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const tasks = useTasks();
  const archivedTasks = useTasks({ includeArchived: true });
  const lists = useTaskLists();
  const tags = useTaskTags();

  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    void ensureDefaultTaskLists();
  }, []);

  const tasksById = useMemo(() => new Map(tasks.filter((t) => t.id != null).map((t) => [t.id!, t])), [tasks]);
  const grouped = useMemo(() => groupTasksByList(tasks), [tasks]);
  const archived = useMemo(() => archivedTasks.filter((t) => t.archived), [archivedTasks]);
  const doneToday = useMemo(
    () => tasks.filter((t) => t.lastCompletedAt && dayjs(t.lastCompletedAt).isSame(dayjs(), "day")).length,
    [tasks],
  );

  useEffect(() => {
    if (pendingTaskId == null) return;
    const t = tasksById.get(pendingTaskId);
    // On a fresh mount (e.g. jumping here from the Command Palette while some other
    // section was active), useTasks()'s live query hasn't resolved yet on the first
    // render — tasksById is still empty. Only consume pendingTaskId once the task is
    // actually found, so this effect naturally re-checks on the next render (when the
    // live query resolves) instead of silently clearing the request against stale data.
    if (!t) return;
    setEditingTask(t);
    setDetailOpen(true);
    onConsumePendingTaskId();
  }, [pendingTaskId, tasksById, onConsumePendingTaskId]);

  function openTask(id: number) {
    const t = tasksById.get(id);
    if (t) {
      setEditingTask(t);
      setDetailOpen(true);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
          flexShrink: 0,
          background: "var(--toolbar-bg)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          position: "relative",
          zIndex: 10,
        }}
        className="safe-top"
      >
        {!isMobile && <SectionTabs section={section} onChange={onChangeSection} />}
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1, minWidth: 100 }}>Tasks</div>
        {doneToday > 0 && (
          <span
            className="label-caps"
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999,
              background: `linear-gradient(135deg, ${tokens.emberHot}22, ${tokens.accent}22)`,
              boxShadow: `0 0 8px ${tokens.accent}55`,
              color: "var(--accent)", fontSize: 11,
            }}
          >
            <TbFlame size={12} /> {doneToday} done today
          </span>
        )}
        <Button type="text" size="small" icon={<TbListDetails size={16} />} onClick={() => setListManagerOpen(true)} aria-label="Manage lists" />
        <Button type="text" size="small" icon={<TbTags size={16} />} onClick={() => setTagManagerOpen(true)} aria-label="Manage tags" />
        <Button type="text" size="small" icon={<TbArchive size={16} />} onClick={() => setArchiveOpen(true)} aria-label="Archive" />
      </div>

      <TaskComposer lists={lists} tags={tags} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {lists.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>
            Setting up your board…
          </div>
        ) : (
          <KanbanBoard lists={lists} grouped={grouped} tasksById={tasksById} tags={tags} onOpenTask={openTask} />
        )}
      </div>

      <TaskDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} task={editingTask} lists={lists} tags={tags} />
      <TaskListManager open={listManagerOpen} onClose={() => setListManagerOpen(false)} lists={lists} />
      <TaskTagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} tags={tags} />
      <TaskArchiveView open={archiveOpen} onClose={() => setArchiveOpen(false)} tasks={archived} lists={lists} />
    </div>
  );
}
