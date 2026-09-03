import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Button, Input, InputNumber, Segmented, Switch, Popconfirm, App } from "antd";
import { TbTrash, TbRepeat, TbHistory } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { createChore, updateChore, archiveChore } from "../../lib/chores";
import { todayKey, combineDateTime } from "../../lib/date.utils";
import type { ChoreDto, TaskRecurrenceDto } from "../../db/types";

type RepeatChoice = "none" | TaskRecurrenceDto["type"];

interface Props {
  open: boolean;
  onClose: () => void;
  chore?: ChoreDto | null; // present -> edit mode; absent -> create mode
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function ChoreEditorSheet({ open, onClose, chore }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const { message } = App.useApp();
  const isEdit = !!chore;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(todayKey());
  const [repeat, setRepeat] = useState<RepeatChoice>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"day" | "week">("day");
  const [rescheduleFromCompletion, setRescheduleFromCompletion] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (chore) {
      setTitle(chore.title);
      setNotes(chore.notes ?? "");
      setDueDate(chore.dueDate?.slice(0, 10) ?? todayKey());
      setRepeat(chore.recurrence?.type ?? "none");
      setWeekdays(chore.recurrence?.weekdays ?? []);
      setDayOfMonth(chore.recurrence?.dayOfMonth ?? 1);
      setCustomInterval(chore.recurrence?.interval ?? 2);
      setCustomUnit(chore.recurrence?.customUnit ?? "day");
      setRescheduleFromCompletion(chore.rescheduleFromCompletion);
    } else {
      setTitle("");
      setNotes("");
      setDueDate(todayKey());
      setRepeat("none");
      setWeekdays([]);
      setDayOfMonth(1);
      setCustomInterval(2);
      setCustomUnit("day");
      setRescheduleFromCompletion(false);
    }
  }, [open, chore]);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function handleSave() {
    if (!title.trim()) return;
    // A "weekly" recurrence with zero weekdays selected can never produce an
    // occurrence (expandOccurrences' weekly branch no-ops when its weekdays
    // set is empty) — for a chore that's worse than for a plain event, since
    // completeChore() then silently falls back to "no next occurrence ->
    // complete normally," turning what looked like a recurring chore into a
    // one-off the instant it's first checked off. Defaulting to today's
    // weekday here is the last line of defense; the repeat-button onClick
    // below already does the same so this should rarely actually fire.
    const safeWeekdays = weekdays.length > 0 ? weekdays : [dayjs().day()];
    const recurrence: TaskRecurrenceDto | null = repeat === "none" ? null : {
      type: repeat,
      weekdays: repeat === "weekly" ? safeWeekdays : undefined,
      dayOfMonth: repeat === "monthly" ? dayOfMonth : undefined,
      interval: repeat === "custom" ? customInterval : undefined,
      customUnit: repeat === "custom" ? customUnit : undefined,
      endDate: null,
      excludedDates: [],
    };

    const patch = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: combineDateTime(dueDate, "00:00"),
      recurrence,
      rescheduleFromCompletion: repeat === "none" ? false : rescheduleFromCompletion,
    };

    if (isEdit && chore?.id) {
      await updateChore(chore.id, patch);
    } else {
      await createChore(patch);
    }
    message.success(isEdit ? "Chore updated" : "Chore added");
    onClose();
  }

  async function handleArchive() {
    if (!chore?.id) return;
    await archiveChore(chore.id);
    message.success("Chore archived");
    onClose();
  }

  return (
    <Sheet
      open={open} onCancel={onClose} footer={null} title={isEdit ? "Edit chore" : "Add chore"}
      mobileFullHeight styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onPressEnter={handleSave} autoFocus />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Due</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)" }} />
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <TbRepeat size={14} /> Repeats
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["none", "daily", "weekly", "monthly", "custom"] as RepeatChoice[]).map((r) => (
              <button key={r} onClick={() => {
                setRepeat(r);
                if (r === "weekly") setWeekdays((prev) => (prev.length > 0 ? prev : [dayjs().day()]));
              }} style={{
                flex: "1 0 30%", padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: "capitalize",
                border: `1px solid ${repeat === r ? "var(--accent)" : "var(--border)"}`,
                background: repeat === r ? `${tokens.accent}18` : "var(--surface)",
                color: repeat === r ? "var(--accent)" : "var(--ink)", cursor: "pointer",
              }}>
                {r}
              </button>
            ))}
          </div>

          {repeat === "weekly" && (
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              {WEEKDAY_LABELS.map((label, i) => (
                <button key={i} onClick={() => toggleWeekday(i)} style={{
                  width: 30, height: 30, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                  border: `1px solid ${weekdays.includes(i) ? "var(--accent)" : "var(--border)"}`,
                  background: weekdays.includes(i) ? "var(--accent)" : "transparent",
                  color: weekdays.includes(i) ? "#fff" : "var(--ink)", cursor: "pointer",
                }}>
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
              <Segmented size="small" value={customUnit} onChange={(v) => setCustomUnit(v as "day" | "week")}
                options={[{ label: "days", value: "day" }, { label: "weeks", value: "week" }]} />
            </div>
          )}

          {repeat !== "none" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <TbHistory size={14} /> Reschedule from completion date
              </span>
              <Switch size="small" checked={rescheduleFromCompletion} onChange={setRescheduleFromCompletion} />
            </div>
          )}
          {repeat !== "none" && (
            <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
              {rescheduleFromCompletion
                ? "Next due date counts from whenever you actually finish it, not the original schedule."
                : "Next due date follows the fixed schedule above, whenever you finish it."}
            </div>
          )}
        </div>

        <Input.TextArea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <Button type="primary" onClick={handleSave}>{isEdit ? "Save" : "Add chore"}</Button>

        {isEdit && (
          <Popconfirm
            title="Archive this chore?"
            description="It's removed from your lists but its history is kept."
            okText="Archive" okButtonProps={{ danger: true }}
            onConfirm={handleArchive}
          >
            <Button danger icon={<TbTrash />}>Archive</Button>
          </Popconfirm>
        )}
      </div>
    </Sheet>
  );
}
