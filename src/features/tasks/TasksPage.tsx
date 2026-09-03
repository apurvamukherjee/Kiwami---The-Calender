import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import dayjs from "dayjs";
import { Button, Input, Segmented, Switch, Select, Popconfirm, App } from "antd";
import { TbArchive, TbListDetails, TbTags, TbFlame, TbTarget, TbChartBar, TbRepeat, TbSun, TbSquareCheck, TbX, TbFolderSymlink } from "react-icons/tb";
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
import { FocusSheet } from "./FocusSheet";
import { WeeklyReviewSheet } from "./WeeklyReviewSheet";
import {
  useTasks, useTaskLists, useTaskTags, ensureDefaultTaskLists, groupTasksByList,
  bulkArchiveTasks, bulkMoveTasks, type TaskScopeFilter,
} from "../../lib/tasks";
import type { TaskDto } from "../../db/types";

const SCOPE_OPTIONS = [
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbSun size={13} /> Today</span>, value: "today" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbRepeat size={13} /> Recurring</span>, value: "recurring" },
  { label: "All", value: "all" },
];

interface Props {
  section: Section;
  onChangeSection: (s: Section) => void;
  pendingTaskId?: number;
  onConsumePendingTaskId: () => void;
  // Command Palette's "Focus"/"Weekly review" static actions jump here the
  // same way a task-search result does (App.tsx's goToTask), just without
  // needing to wait on a live-query lookup first — both sheets open
  // immediately, so this is consumed as soon as it's seen.
  pendingTasksAction?: "focus" | "weekly-review" | null;
  onConsumePendingTasksAction: () => void;
}

// Tasks section shell, mirroring NotesPage.tsx/CalendarPage.tsx's structure: sticky
// toolbar -> pinned TaskComposer -> the Kanban board filling the rest of the viewport.
export function TasksPage({
  section, onChangeSection, pendingTaskId, onConsumePendingTaskId, pendingTasksAction, onConsumePendingTasksAction,
}: Props) {
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const { message } = App.useApp();
  const tasks = useTasks();
  const archivedTasks = useTasks({ includeArchived: true });
  const lists = useTaskLists();
  const tags = useTaskTags();

  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [weeklyReviewOpen, setWeeklyReviewOpen] = useState(false);
  const composerRef = useRef<ComponentRef<typeof Input.TextArea>>(null);
  // Board-view filter, separate from FocusSheet's own tier/energy logic below
  // (FocusSheet keeps reading the full, unfiltered `tasks`) — defaults to
  // "today's plate, done stuff hidden" per the user's ask; both are one tap
  // away from "All"/"show completed" when a full-board view is wanted.
  const [scope, setScope] = useState<TaskScopeFilter>("today");
  const [hideCompleted, setHideCompleted] = useState(true);
  // Bulk-select mode (Part G of TASKS_FEATURE_PLAN.md) — a board-view
  // concern like scope/hideCompleted above, not a data-scoping one.
  // Selected ids are cleared on every mode toggle so leaving select mode
  // never leaves a stale selection armed the next time it's re-entered.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveToListId, setMoveToListId] = useState<number | undefined>(undefined);

  useEffect(() => {
    void ensureDefaultTaskLists();
  }, []);

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function handleBulkArchive() {
    const ids = [...selectedIds];
    await bulkArchiveTasks(ids);
    message.success(`${ids.length} task${ids.length === 1 ? "" : "s"} archived`);
    setSelectedIds(new Set());
    setSelectMode(false);
  }
  async function handleBulkMove() {
    if (moveToListId == null) return;
    const ids = [...selectedIds];
    await bulkMoveTasks(ids, moveToListId);
    message.success(`${ids.length} task${ids.length === 1 ? "" : "s"} moved`);
    setSelectedIds(new Set());
    setSelectMode(false);
    setMoveToListId(undefined);
  }

  const anySheetOpen = detailOpen || listManagerOpen || tagManagerOpen || archiveOpen || focusOpen || weeklyReviewOpen;

  // "n" focuses the composer — mirrors CalendarPage.tsx's arrow-key/"T"
  // pattern: skipped while typing anywhere or while a sheet is open, so it
  // never fights with form inputs.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (anySheetOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        composerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anySheetOpen]);

  const tasksById = useMemo(() => new Map(tasks.filter((t) => t.id != null).map((t) => [t.id!, t])), [tasks]);
  const grouped = useMemo(() => groupTasksByList(tasks), [tasks]);
  const archived = useMemo(() => archivedTasks.filter((t) => t.archived), [archivedTasks]);
  // Derived from archivedTasks (includeArchived: true), not tasks — a task
  // completed and archived the same day would otherwise silently drop out
  // of this count the moment it's archived.
  const doneToday = useMemo(
    () => archivedTasks.filter((t) => t.lastCompletedAt && dayjs(t.lastCompletedAt).isSame(dayjs(), "day")).length,
    [archivedTasks],
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

  useEffect(() => {
    if (!pendingTasksAction) return;
    if (pendingTasksAction === "focus") setFocusOpen(true);
    else setWeeklyReviewOpen(true);
    onConsumePendingTasksAction();
  }, [pendingTasksAction, onConsumePendingTasksAction]);

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
        <Button type="text" size="small" icon={<TbTarget size={16} />} onClick={() => setFocusOpen(true)} aria-label="Focus" />
        <Button type="text" size="small" icon={<TbChartBar size={16} />} onClick={() => setWeeklyReviewOpen(true)} aria-label="Weekly review" />
        <Button
          type={selectMode ? "primary" : "text"} size="small" icon={<TbSquareCheck size={16} />}
          onClick={toggleSelectMode} aria-label={selectMode ? "Exit select mode" : "Select tasks"}
        />
        <Button type="text" size="small" icon={<TbListDetails size={16} />} onClick={() => setListManagerOpen(true)} aria-label="Manage lists" />
        <Button type="text" size="small" icon={<TbTags size={16} />} onClick={() => setTagManagerOpen(true)} aria-label="Manage tags" />
        <Button type="text" size="small" icon={<TbArchive size={16} />} onClick={() => setArchiveOpen(true)} aria-label="Archive" />
      </div>

      <TaskComposer lists={lists} tags={tags} textAreaRef={composerRef} />

      {selectMode ? (
        // Bulk-action bar (Part G) — replaces the scope/hideCompleted row
        // while select mode is active, since filtering the board and
        // bulk-acting on a selection are mutually exclusive moments.
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "8px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedIds.size} selected</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Select
              size="small" placeholder="Move to…" style={{ minWidth: 140 }}
              value={moveToListId} onChange={setMoveToListId}
              options={lists.map((l) => ({ label: l.name, value: l.id }))}
            />
            <Button size="small" icon={<TbFolderSymlink size={13} />} disabled={selectedIds.size === 0 || moveToListId == null} onClick={handleBulkMove}>
              Move
            </Button>
            <Popconfirm title={`Archive ${selectedIds.size} task${selectedIds.size === 1 ? "" : "s"}?`} okText="Archive" onConfirm={handleBulkArchive} disabled={selectedIds.size === 0}>
              <Button size="small" danger icon={<TbArchive size={13} />} disabled={selectedIds.size === 0}>Archive</Button>
            </Popconfirm>
            <Button size="small" icon={<TbX size={13} />} onClick={toggleSelectMode}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "8px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", flexShrink: 0,
        }}>
          <Segmented size="small" value={scope} onChange={(v) => setScope(v as TaskScopeFilter)} options={SCOPE_OPTIONS} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Show completed</span>
            <Switch size="small" checked={!hideCompleted} onChange={(v) => setHideCompleted(!v)} />
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {lists.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>
            Setting up your board…
          </div>
        ) : (
          <KanbanBoard
            lists={lists} grouped={grouped} tasksById={tasksById} tags={tags} onOpenTask={openTask}
            scope={selectMode ? "all" : scope} hideCompleted={selectMode ? false : hideCompleted}
            selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect}
          />
        )}
      </div>

      <TaskDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} task={editingTask} lists={lists} tags={tags} />
      <TaskListManager open={listManagerOpen} onClose={() => setListManagerOpen(false)} lists={lists} />
      <TaskTagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} tags={tags} />
      <TaskArchiveView open={archiveOpen} onClose={() => setArchiveOpen(false)} tasks={archived} lists={lists} />
      <FocusSheet open={focusOpen} onClose={() => setFocusOpen(false)} tasks={tasks} tags={tags} />
      <WeeklyReviewSheet open={weeklyReviewOpen} onClose={() => setWeeklyReviewOpen(false)} />
    </div>
  );
}
