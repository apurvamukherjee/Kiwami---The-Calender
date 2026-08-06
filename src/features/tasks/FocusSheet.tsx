import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Segmented } from "antd";
import { TbCheck, TbPlayerTrackNext, TbBan, TbCalendarPlus, TbFlag, TbBattery1, TbBattery2, TbBolt, TbMoodCheck } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { completeTask, markTaskWontDo, updateTask, PRIORITY_TOKEN_KEY } from "../../lib/tasks";
import { combineDateTime, todayKey } from "../../lib/date.utils";
import { hapticLight, hapticSuccess } from "../../lib/haptics";
import type { TaskDto, TaskTagDto } from "../../db/types";

type EnergyFilter = "any" | "low" | "medium" | "high";
const ENERGY_ICON = { low: TbBattery1, medium: TbBattery2, high: TbBolt };

interface Props {
  open: boolean;
  onClose: () => void;
  tasks: TaskDto[]; // non-archived (TasksPage's existing useTasks())
  tags: TaskTagDto[];
}

// One task at a time — a deliberate D6+D7 merge (see TASKS_FEATURE_PLAN.md):
// "what am I doing right now" and "what am I doing today" are the same
// decision for a solo user, not two screens. The queue itself doubles as
// the guided daily plan; "Schedule for today" is the planning action folded
// into the same card instead of a separate view.
function buildQueue(tasks: TaskDto[], energyFilter: EnergyFilter, today: string): TaskDto[] {
  const candidates = tasks.filter((t) => !t.completed && !t.wontDo && (energyFilter === "any" || !t.energy || t.energy === energyFilter));
  function tier(t: TaskDto): 0 | 1 | 2 {
    const scheduled = (t.doDate ?? t.dueDate)?.slice(0, 10);
    if (scheduled && scheduled < today) return 0; // overdue
    if (scheduled === today) return 1; // due/do today
    return 2; // backlog
  }
  const priorityRank: Record<TaskDto["priority"], number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  return [...candidates].sort((a, b) => {
    const ta = tier(a), tb = tier(b);
    if (ta !== tb) return ta - tb;
    const pa = priorityRank[a.priority], pb = priorityRank[b.priority];
    if (pa !== pb) return pa - pb;
    return a.createdAt - b.createdAt; // oldest first, so nothing gets perpetually buried
  });
}

export function FocusSheet({ open, onClose, tasks, tags }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const today = todayKey();
  const [energyFilter, setEnergyFilter] = useState<EnergyFilter>("any");
  const [currentTaskId, setCurrentTaskId] = useState<number | undefined>(undefined);
  // Content-only sheet, no autoFocus field — same antd Modal focus-trap gap
  // TaskListManager.tsx/TaskArchiveView.tsx already hit and fixed: without
  // this, Escape never reaches the dialog because focus never lands inside
  // it on open.
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setEnergyFilter("any");
      setCurrentTaskId(undefined);
    }
  }, [open]);

  const queue = useMemo(() => buildQueue(tasks, energyFilter, today), [tasks, energyFilter, today]);

  useEffect(() => {
    if (currentTaskId == null || !queue.some((t) => t.id === currentTaskId)) {
      setCurrentTaskId(queue[0]?.id);
    }
  }, [queue, currentTaskId]);

  const currentIndex = queue.findIndex((t) => t.id === currentTaskId);
  const current = currentIndex >= 0 ? queue[currentIndex] : undefined;
  const currentTags = current ? current.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is TaskTagDto => !!t) : [];
  // "Schedule for today" is offered whenever the task isn't already
  // do/due-dated today — that covers backlog (no date, or future-dated) AND
  // overdue tasks, since rescheduling an overdue task to today is exactly
  // as useful as pulling in an undated backlog one.
  const scheduledToday = !!current && (current.doDate ?? current.dueDate)?.slice(0, 10) === today;

  // Proactively refocus the content wrapper before advancing — advancing
  // can transiently render the "All clear" empty state (e.g. the last item
  // in the queue), which unmounts the just-clicked action button. The DOM
  // spec resets focus to <body> when the focused element is removed, which
  // would silently break Escape for the rest of the sheet's lifetime — same
  // root cause already documented and fixed for TaskArchiveView.tsx/
  // TaskListManager.tsx's row-removal case.
  function advance() {
    contentRef.current?.focus();
    setCurrentTaskId(queue[currentIndex + 1]?.id);
  }

  async function handleDone() {
    if (!current?.id) return;
    hapticSuccess();
    advance();
    await completeTask(current.id, true);
  }
  function handleSkip() {
    hapticLight();
    advance();
  }
  async function handleWontDo() {
    if (!current?.id) return;
    hapticLight();
    advance();
    await markTaskWontDo(current.id, true);
  }
  async function handleScheduleToday() {
    if (!current?.id) return;
    hapticLight();
    await updateTask(current.id, { doDate: combineDateTime(today, "00:00") });
  }
  async function toggleSubtask(subtaskId: string) {
    if (!current?.id) return;
    const next = current.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
    await updateTask(current.id, { subtasks: next });
  }

  return (
    <Sheet
      open={open}
      onCancel={onClose}
      footer={null}
      title="Focus"
      afterOpenChange={(isOpen) => { if (isOpen) contentRef.current?.focus(); }}
      styles={{
        content: { background: `${tokens.surfaceLowest}e6`, backdropFilter: "blur(20px)" },
        header: { background: "transparent" },
      }}
    >
      <div ref={contentRef} tabIndex={-1} style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "8px 0 4px", outline: "none" }}>
        <div style={{
          position: "absolute", top: -80, right: -80, width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${tokens.accent}22, transparent 70%)`,
          filter: "blur(40px)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <Segmented
            block
            value={energyFilter}
            onChange={(v) => setEnergyFilter(v as EnergyFilter)}
            options={[
              { label: "Any energy", value: "any" },
              { label: <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}><TbBattery1 size={13} /> Low</span>, value: "low" },
              { label: <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}><TbBattery2 size={13} /> Medium</span>, value: "medium" },
              { label: <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}><TbBolt size={13} /> High</span>, value: "high" },
            ]}
          />

          {!current ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "48px 0" }}>
              <TbMoodCheck size={32} style={{ color: "var(--ink-soft)", opacity: 0.6 }} />
              <div style={{ fontSize: 15, fontWeight: 800 }}>All clear</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", maxWidth: 260 }}>
                Nothing left in this queue{energyFilter !== "any" ? " for that energy level" : ""}.
              </div>
            </div>
          ) : (
            <>
              <div className="label-caps" style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 11 }}>
                {currentIndex + 1} of {queue.length}
              </div>

              <div style={{ textAlign: "center", padding: "0 8px" }}>
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, lineHeight: 1.25,
                  color: "var(--ink)",
                }}>
                  {current.title}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: tokens[PRIORITY_TOKEN_KEY[current.priority]] }}>
                    <TbFlag size={12} /> {current.priority}
                  </span>
                  {current.energy && (() => {
                    const Icon = ENERGY_ICON[current.energy];
                    return <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--ink-soft)" }}><Icon size={12} /> {current.energy}</span>;
                  })()}
                  {currentTags.map((t) => (
                    <span key={t.id} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: t.color }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color }} /> {t.name}
                    </span>
                  ))}
                </div>
              </div>

              {current.subtasks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 8px" }}>
                  {current.subtasks.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Checkbox checked={s.done} onChange={() => void toggleSubtask(s.id)} />
                      <span style={{ fontSize: 13, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <Button block size="large" type="primary" icon={<TbCheck />} onClick={handleDone} style={{ borderRadius: 14 }}>Done</Button>
                <Button block size="large" icon={<TbPlayerTrackNext />} onClick={handleSkip} style={{ borderRadius: 14 }}>Skip</Button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button block icon={<TbBan />} onClick={handleWontDo}>Won't do</Button>
                {!scheduledToday && <Button block icon={<TbCalendarPlus />} onClick={handleScheduleToday}>Schedule for today</Button>}
              </div>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
