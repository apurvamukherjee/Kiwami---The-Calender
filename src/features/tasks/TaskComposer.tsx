import { useEffect, useState, type ComponentRef, type RefObject } from "react";
import { Input, Select, Button, Tag, Segmented } from "antd";
import dayjs from "dayjs";
import { TbCalendar, TbX, TbChevronDown, TbChevronUp, TbFlag, TbRepeat, TbPlus, TbListCheck } from "react-icons/tb";
import { parseNoteText } from "../../lib/parseNoteText";
import { createTask, PRIORITY_LABEL, PRIORITY_TOKEN_KEY } from "../../lib/tasks";
import { useTokens } from "../../hooks/useTokens";
import { hapticSuccess } from "../../lib/haptics";
import type { TaskListDto, TaskTagDto, TaskPriority, TaskRecurrenceDto, TaskSubtaskDto } from "../../db/types";

const PRIORITY_OPTIONS: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];
type RepeatChoice = "none" | "daily" | "weekly" | "monthly";
const REPEAT_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

interface Props {
  lists: TaskListDto[];
  tags: TaskTagDto[];
  // TasksPage's "n" shortcut focuses the composer through this — optional
  // since not every caller (there's only one today) needs it.
  textAreaRef?: RefObject<ComponentRef<typeof Input.TextArea> | null>;
}

// Pinned quick-capture bar, mirroring NoteComposer.tsx: text is live-parsed on every
// keystroke via parseNoteText (chrono-node, fully offline) so a date chip appears as
// you type. Recurrence here is intentionally simplified (no weekday/day-of-month
// picker) — TaskDetailSheet exposes the full recurrence sub-form for refinement after
// creation, matching how NoteComposer's quick-add doesn't expose everything
// NoteEditorSheet does either.
export function TaskComposer({ lists, tags, textAreaRef }: Props) {
  const tokens = useTokens();
  const [rawText, setRawText] = useState("");
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  const [allDay, setAllDay] = useState(false);
  const [dateOverridden, setDateOverridden] = useState(false);
  const [listId, setListId] = useState<number | undefined>(lists[0]?.id);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [repeat, setRepeat] = useState<RepeatChoice>("none");
  const [subtasks, setSubtasks] = useState<TaskSubtaskDto[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  useEffect(() => {
    if (listId === undefined && lists[0]?.id != null) setListId(lists[0].id);
  }, [lists, listId]);

  function onTextChange(text: string) {
    setRawText(text);
    const parsed = parseNoteText(text);
    if (!dateOverridden) {
      setDueDate(parsed.dueDate);
      setAllDay(parsed.allDay);
    }
  }

  function clearDate() {
    setDueDate(undefined);
    setDateOverridden(false);
    const parsed = parseNoteText(rawText);
    setDueDate(parsed.dueDate);
    setAllDay(parsed.allDay);
  }

  function addSubtask() {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: t, done: false }]);
    setNewSubtask("");
  }
  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  function buildRecurrence(): TaskRecurrenceDto | null {
    if (repeat === "none" || !dueDate) return null;
    const d = dayjs(dueDate);
    if (repeat === "daily") return { type: "daily", excludedDates: [] };
    if (repeat === "weekly") return { type: "weekly", weekdays: [d.day()], excludedDates: [] };
    return { type: "monthly", dayOfMonth: d.date(), excludedDates: [] };
  }

  async function handleSave() {
    const parsed = parseNoteText(rawText);
    const title = parsed.title;
    if (!title.trim() || listId == null) return;

    await createTask({
      listId,
      title: title.trim(),
      dueDate,
      allDay,
      priority,
      tagIds,
      subtasks,
      recurrence: buildRecurrence(),
    });

    hapticSuccess();
    setRawText("");
    setDueDate(undefined);
    setAllDay(false);
    setDateOverridden(false);
    setPriority("none");
    setTagIds([]);
    setRepeat("none");
    setSubtasks([]);
    setNewSubtask("");
    setExpanded(false);
  }

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--toolbar-bg)" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Select size="small" value={listId} onChange={setListId} style={{ minWidth: 140 }} options={lists.map((l) => ({ label: l.name, value: l.id }))} />
        <Select
          size="small"
          value={priority}
          onChange={(v) => setPriority(v as TaskPriority)}
          style={{ minWidth: 116 }}
          options={PRIORITY_OPTIONS.map((p) => ({
            label: (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <TbFlag size={12} style={{ color: tokens[PRIORITY_TOKEN_KEY[p]] }} /> {PRIORITY_LABEL[p]}
              </span>
            ),
            value: p,
          }))}
        />
      </div>

      <Input.TextArea
        ref={textAreaRef}
        placeholder='Add a task — try "renew passport next friday"'
        value={rawText}
        onChange={(e) => onTextChange(e.target.value)}
        onPressEnter={(e) => { e.preventDefault(); void handleSave(); }}
        autoSize={{ minRows: 1, maxRows: 4 }}
      />

      {dueDate && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          <Tag icon={<TbCalendar size={12} style={{ verticalAlign: -1 }} />} closable closeIcon={<TbX size={11} />} onClose={clearDate} color="var(--accent)">
            {allDay ? dayjs(dueDate).format("D MMM") : dayjs(dueDate).format("D MMM, HH:mm")}
          </Tag>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <Button type="text" size="small" onClick={() => setExpanded((v) => !v)} icon={expanded ? <TbChevronUp size={14} /> : <TbChevronDown size={14} />}>
          Details
        </Button>
        <Button type="primary" size="small" onClick={handleSave} disabled={!rawText.trim() || listId == null}>Add</Button>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <Select mode="multiple" size="small" placeholder="Tags" value={tagIds} onChange={(v) => setTagIds(v as number[])} options={tags.map((t) => ({ label: t.name, value: t.id }))} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <TbListCheck size={13} /> Subtasks
            </div>
            {subtasks.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{s.title}</span>
                <Button type="text" size="small" icon={<TbX size={13} />} onClick={() => removeSubtask(s.id)} aria-label="Remove subtask" />
              </div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <Input size="small" placeholder="Add a subtask" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onPressEnter={addSubtask} />
              <Button size="small" icon={<TbPlus size={14} />} onClick={addSubtask} />
            </div>
          </div>
          {dueDate && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <TbRepeat size={13} /> Repeats
              </div>
              <Segmented size="small" value={repeat} onChange={(v) => setRepeat(v as RepeatChoice)} options={REPEAT_OPTIONS} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
