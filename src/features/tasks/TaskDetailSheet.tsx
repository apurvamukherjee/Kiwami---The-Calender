import { useEffect, useState } from "react";
import { Button, Input, Select, Switch, InputNumber, Segmented, Popconfirm, App, Checkbox } from "antd";
import dayjs from "dayjs";
import { TbArchive, TbPlus, TbX, TbRepeat, TbFlag, TbBan, TbArrowBackUp, TbCalendarEvent } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { TimeSelect } from "../../components/TimeSelect";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { updateTask, archiveTask, createTaskTag, markTaskWontDo, PRIORITY_LABEL, PRIORITY_TOKEN_KEY } from "../../lib/tasks";
import { todayKey, combineDateTime } from "../../lib/date.utils";
import { hapticLight, hapticSuccess } from "../../lib/haptics";
import type { TaskDto, TaskListDto, TaskTagDto, TaskPriority, TaskSubtaskDto, TaskRecurrenceDto, RecurrenceType } from "../../db/types";

type RepeatChoice = "none" | RecurrenceType;
const PRIORITY_OPTIONS: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  open: boolean;
  onClose: () => void;
  task: TaskDto | null;
  lists: TaskListDto[];
  tags: TaskTagDto[];
}

// Full editor for an existing task — mirrors NoteEditorSheet.tsx's save/toast/Sheet
// pattern plus EventEditorSheet.tsx's recurrence sub-form (routine/streak-specific UI
// stripped, since tasks never get occurrenceStatus rows — see lib/tasks.ts's
// completeTask()). Tasks are only ever created via TaskComposer/TaskColumn's inline
// quick-add, so unlike EventEditorSheet this sheet has no create mode.
export function TaskDetailSheet({ open, onClose, task, lists, tags }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const { message } = App.useApp();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [hasDate, setHasDate] = useState(false);
  const [dueDate, setDueDate] = useState(todayKey());
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("09:00");
  const [hasDoDate, setHasDoDate] = useState(false);
  const [doDateValue, setDoDateValue] = useState(todayKey());
  const [subtasks, setSubtasks] = useState<TaskSubtaskDto[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [repeat, setRepeat] = useState<RepeatChoice>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"day" | "week">("day");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(todayKey());
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setListId(task.listId);
    setPriority(task.priority);
    setTagIds(task.tagIds);
    setHasDate(!!task.dueDate);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : todayKey());
    setAllDay(!!task.allDay);
    setTime(task.dueDate ? dayjs(task.dueDate).format("HH:mm") : "09:00");
    setHasDoDate(!!task.doDate);
    setDoDateValue(task.doDate ? task.doDate.slice(0, 10) : task.dueDate ? task.dueDate.slice(0, 10) : todayKey());
    setSubtasks(task.subtasks);
    const rule = task.recurrence;
    setRepeat(rule?.type ?? "none");
    setWeekdays(rule?.weekdays ?? []);
    setDayOfMonth(rule?.dayOfMonth ?? 1);
    setCustomInterval(rule?.interval ?? 2);
    setCustomUnit(rule?.customUnit ?? "day");
    setHasEndDate(!!rule?.endDate);
    setEndDate(rule?.endDate ?? todayKey());
    setNewTagName("");
  }, [open, task]);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function addSubtask() {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: t, done: false }]);
    setNewSubtask("");
  }
  function toggleSubtask(id: string) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  }
  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  async function addNewTag() {
    const name = newTagName.trim();
    if (!name) return;
    const id = await createTaskTag({ name, color: tokens.accent });
    setTagIds((prev) => [...prev, id]);
    setNewTagName("");
  }

  async function handleSave() {
    if (!task?.id || !title.trim() || listId == null) return;

    const recurrence: TaskRecurrenceDto | null =
      repeat === "none" || !hasDate
        ? null
        : {
            type: repeat,
            weekdays: repeat === "weekly" ? weekdays : undefined,
            dayOfMonth: repeat === "monthly" ? dayOfMonth : undefined,
            interval: repeat === "custom" ? customInterval : undefined,
            customUnit: repeat === "custom" ? customUnit : undefined,
            endDate: hasEndDate ? endDate : null,
            excludedDates: [],
          };

    await updateTask(task.id, {
      listId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      tagIds,
      subtasks,
      dueDate: hasDate ? combineDateTime(dueDate, allDay ? "00:00" : time) : undefined,
      allDay: hasDate ? allDay : undefined,
      doDate: hasDoDate ? combineDateTime(doDateValue, "00:00") : undefined,
      recurrence,
    });
    hapticSuccess();
    message.success("Saved");
    onClose();
  }

  async function handleArchive() {
    if (!task?.id) return;
    await archiveTask(task.id);
    hapticLight();
    message.success("Archived");
    onClose();
  }

  async function handleWontDo() {
    if (!task?.id) return;
    await markTaskWontDo(task.id, true);
    hapticLight();
    message.success("Marked as won't do");
    onClose();
  }

  async function handleReopen() {
    if (!task?.id) return;
    await markTaskWontDo(task.id, false);
    hapticLight();
    message.success("Reopened");
  }

  return (
    <Sheet open={open} onCancel={onClose} footer={null} title="Task" styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        <Input.TextArea placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoSize={{ minRows: 1, maxRows: 4 }} autoFocus />

        <Select value={listId} onChange={setListId} options={lists.map((l) => ({ label: l.name, value: l.id }))} />

        <Select
          value={priority}
          onChange={(v) => setPriority(v as TaskPriority)}
          options={PRIORITY_OPTIONS.map((p) => ({
            label: (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <TbFlag size={12} style={{ color: tokens[PRIORITY_TOKEN_KEY[p]] }} /> {PRIORITY_LABEL[p]}
              </span>
            ),
            value: p,
          }))}
        />

        <Select mode="multiple" placeholder="Tags" value={tagIds} onChange={(v) => setTagIds(v as number[])} options={tags.map((t) => ({ label: t.name, value: t.id }))} />
        <div style={{ display: "flex", gap: 6 }}>
          <Input size="small" placeholder="New tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onPressEnter={addNewTag} />
          <Button size="small" icon={<TbPlus size={14} />} onClick={addNewTag} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Due date</span>
          <Switch size="small" checked={hasDate} onChange={setHasDate} />
        </div>
        {hasDate && (
          <>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", width: "100%" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>All-day</span>
              <Switch size="small" checked={allDay} onChange={setAllDay} />
            </div>
            {!allDay && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Time</span>
                <TimeSelect value={time} onChange={setTime} size="small" />
              </div>
            )}

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <TbRepeat size={14} /> Repeats
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["none", "daily", "weekly", "monthly", "custom"] as RepeatChoice[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRepeat(r)}
                    style={{
                      flex: "1 0 30%",
                      padding: "6px 0",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "capitalize",
                      border: `1px solid ${repeat === r ? "var(--accent)" : "var(--border)"}`,
                      background: repeat === r ? `${tokens.accent}18` : "var(--surface)",
                      color: repeat === r ? "var(--accent)" : "var(--ink)",
                      cursor: "pointer",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {repeat === "weekly" && (
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleWeekday(i)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        fontSize: 11,
                        fontWeight: 700,
                        border: `1px solid ${weekdays.includes(i) ? "var(--accent)" : "var(--border)"}`,
                        background: weekdays.includes(i) ? "var(--accent)" : "transparent",
                        color: weekdays.includes(i) ? "#fff" : "var(--ink)",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {repeat === "monthly" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>On day</span>
                  <InputNumber size="small" min={1} max={31} value={dayOfMonth} onChange={(v) => setDayOfMonth(v ?? 1)} />
                </div>
              )}

              {repeat === "custom" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Every</span>
                  <InputNumber size="small" min={1} max={365} value={customInterval} onChange={(v) => setCustomInterval(v ?? 1)} style={{ width: 70 }} />
                  <Segmented size="small" value={customUnit} onChange={(v) => setCustomUnit(v as "day" | "week")} options={[{ label: "days", value: "day" }, { label: "weeks", value: "week" }]} />
                </div>
              )}

              {repeat !== "none" && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Ends on a date</span>
                    <Switch size="small" checked={hasEndDate} onChange={setHasEndDate} />
                  </div>
                  {hasEndDate && (
                    <input
                      type="date"
                      value={endDate}
                      min={dueDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ marginTop: 6, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", width: "100%" }}
                    />
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            <TbCalendarEvent size={14} /> Do date
          </span>
          <Switch size="small" checked={hasDoDate} onChange={setHasDoDate} />
        </div>
        {hasDoDate && (
          <input
            type="date"
            value={doDateValue}
            onChange={(e) => setDoDateValue(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", width: "100%" }}
          />
        )}

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Subtasks</div>
          {subtasks.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Checkbox checked={s.done} onChange={() => toggleSubtask(s.id)} />
              <span style={{ flex: 1, fontSize: 13, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
              <Button type="text" size="small" icon={<TbX size={13} />} onClick={() => removeSubtask(s.id)} aria-label="Remove subtask" />
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <Input size="small" placeholder="Add a subtask" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onPressEnter={addSubtask} />
            <Button size="small" icon={<TbPlus size={14} />} onClick={addSubtask} />
          </div>
        </div>

        <Input.TextArea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

        <Button type="primary" onClick={handleSave}>Save</Button>

        {task?.wontDo ? (
          <Button icon={<TbArrowBackUp />} onClick={handleReopen}>Reopen</Button>
        ) : (
          <Popconfirm title="Mark as won't do?" description="You can reopen it later." okText="Won't do" onConfirm={handleWontDo}>
            <Button icon={<TbBan />}>Won't do</Button>
          </Popconfirm>
        )}

        <Popconfirm title="Archive this task?" description="You can restore it later from the Archive." okText="Archive" onConfirm={handleArchive}>
          <Button danger icon={<TbArchive />}>Archive</Button>
        </Popconfirm>
      </div>
    </Sheet>
  );
}
