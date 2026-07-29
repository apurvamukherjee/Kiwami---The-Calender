import { useEffect, useMemo, useState } from "react";
import { Button, Input, Switch, InputNumber, Segmented } from "antd";
import { TbTrash, TbCalendarOff, TbRepeat, TbMapPin, TbFlame, TbToolsKitchen2 } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { TimeSelect } from "../../components/TimeSelect";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { createEvent, updateEvent, deleteEvent, setRecurrenceRule, deleteOccurrence } from "../../lib/events";
import { todayKey, combineDateTime } from "../../lib/date.utils";
import { hapticLight, hapticSuccess } from "../../lib/haptics";
import type { CalendarItem } from "./useCalendarEvents";
import type { RecurrenceType } from "../../db/types";

type Kind = "plain" | "routine" | "foodSlot";
type RepeatChoice = "none" | RecurrenceType;

interface Props {
  open: boolean;
  onClose: () => void;
  item?: CalendarItem | null; // present -> edit mode; absent -> create mode
  defaultDate?: string;
  defaultTime?: string;
  defaultEndTime?: string;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function EventEditorSheet({ open, onClose, item, defaultDate, defaultTime, defaultEndTime }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const isEdit = !!item;
  const hasRule = !!item?.rule;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Kind>("plain");
  const [date, setDate] = useState(todayKey());
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("09:00");
  const [hasEnd, setHasEnd] = useState(false);
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);
  const [repeat, setRepeat] = useState<RepeatChoice>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"day" | "week">("day");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(todayKey());

  useEffect(() => {
    if (!open) return;
    if (item) {
      const { event, rule } = item;
      setTitle(event.title);
      setDescription(event.description ?? "");
      setKind(event.isRoutine ? "routine" : event.isFoodSlot ? "foodSlot" : "plain");
      setDate(item.date);
      setAllDay(!!event.allDay);
      setTime(item.time ?? "09:00");
      setHasEnd(!!item.endTime);
      setEndTime(item.endTime ?? "10:00");
      setLocation(event.location ?? "");
      setColor(event.color);
      setRepeat(rule?.type ?? "none");
      setWeekdays(rule?.weekdays ?? []);
      setDayOfMonth(rule?.dayOfMonth ?? 1);
      setCustomInterval(rule?.interval ?? 2);
      setCustomUnit(rule?.customUnit ?? "day");
      setHasEndDate(!!rule?.endDate);
      setEndDate(rule?.endDate ?? todayKey());
    } else {
      setTitle("");
      setDescription("");
      setKind("plain");
      setDate(defaultDate ?? todayKey());
      setAllDay(false);
      setTime(defaultTime ?? "09:00");
      setHasEnd(!!defaultEndTime);
      setEndTime(defaultEndTime ?? "10:00");
      setLocation("");
      setColor(undefined);
      setRepeat("none");
      setWeekdays([]);
      setDayOfMonth(1);
      setCustomInterval(2);
      setCustomUnit("day");
      setHasEndDate(false);
      setEndDate(todayKey());
    }
  }, [open, item, defaultDate, defaultTime, defaultEndTime]);

  const swatches = useMemo(() => [tokens.accent, tokens.gold, tokens.teal, tokens.danger], [tokens]);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function handleSave() {
    if (!title.trim()) return;
    const startTime = combineDateTime(date, allDay ? "00:00" : time);
    const finalEndTime = !allDay && hasEnd ? combineDateTime(date, endTime) : undefined;

    const patch = {
      title: title.trim(),
      description: description.trim() || undefined,
      startTime,
      endTime: finalEndTime,
      allDay,
      location: location.trim() || undefined,
      color: kind === "foodSlot" ? undefined : color,
      isRoutine: kind === "routine",
      isFoodSlot: kind === "foodSlot",
    };

    const recurrence = repeat === "none" ? null : {
      type: repeat,
      weekdays: repeat === "weekly" ? weekdays : undefined,
      dayOfMonth: repeat === "monthly" ? dayOfMonth : undefined,
      interval: repeat === "custom" ? customInterval : undefined,
      customUnit: repeat === "custom" ? customUnit : undefined,
      endDate: hasEndDate ? endDate : null,
      excludedDates: item?.rule?.excludedDates ?? [],
    };

    if (isEdit && item?.event.id) {
      await updateEvent(item.event.id, patch);
      await setRecurrenceRule(item.event.id, recurrence);
    } else {
      const id = await createEvent({ ...patch, recurrence });
      void id;
    }
    hapticSuccess();
    onClose();
  }

  async function handleDeleteOccurrence() {
    if (!item?.event.id) return;
    await deleteOccurrence(item.event.id, item.date);
    hapticLight();
    onClose();
  }

  async function handleDeleteSeries() {
    if (!item?.event.id) return;
    await deleteEvent(item.event.id);
    hapticLight();
    onClose();
  }

  return (
    <Sheet open={open} onCancel={onClose} footer={null} title={isEdit ? "Edit event" : "New event"}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        <Segmented
          block
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          options={[
            { label: "Plain", value: "plain" },
            { label: <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}><TbFlame size={13} /> Routine</span>, value: "routine" },
            { label: <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}><TbToolsKitchen2 size={13} /> Food slot</span>, value: "foodSlot" },
          ]}
        />

        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onPressEnter={handleSave} autoFocus />

        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", width: "100%" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>All-day</span>
          <Switch size="small" checked={allDay} onChange={setAllDay} />
        </div>

        {!allDay && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Starts</span>
              <TimeSelect value={time} onChange={setTime} size="small" />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Time block (has an end)</span>
              <Switch size="small" checked={hasEnd} onChange={setHasEnd} />
            </div>
            {hasEnd && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Ends</span>
                <TimeSelect value={endTime} onChange={setEndTime} size="small" />
              </div>
            )}
          </>
        )}

        {/* Recurrence — create mode only, matching the decision that editing
            a recurring event's own cadence is out of scope for a v1 (only
            per-occurrence delete and whole-series delete are supported). */}
        {!isEdit && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <TbRepeat size={14} /> Repeats
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["none", "daily", "weekly", "monthly", "custom"] as RepeatChoice[]).map((r) => (
                <button key={r} onClick={() => setRepeat(r)} style={{
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
                <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>of the month (clamps in shorter months)</span>
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
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Ends on a date</span>
                  <Switch size="small" checked={hasEndDate} onChange={setHasEndDate} />
                </div>
                {hasEndDate && (
                  <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)}
                    style={{ marginTop: 6, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", width: "100%" }} />
                )}
              </div>
            )}
          </div>
        )}
        {isEdit && hasRule && (
          <div style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
            Part of a repeating series — the recurrence pattern itself can't be changed after creation, but you can delete just this occurrence or the whole series below.
          </div>
        )}

        <Input placeholder="Location (optional)" prefix={<TbMapPin size={14} style={{ color: "var(--ink-soft)" }} />}
          value={location} onChange={(e) => setLocation(e.target.value)} />
        <Input.TextArea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

        {kind !== "foodSlot" && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Color</div>
            <div style={{ display: "flex", gap: 8 }}>
              {swatches.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 24, height: 24, borderRadius: "50%", cursor: "pointer",
                  background: c, border: color === c ? "2px solid var(--ink)" : "2px solid transparent",
                }} />
              ))}
            </div>
          </div>
        )}

        <Button type="primary" onClick={handleSave}>{isEdit ? "Save" : "Create"}</Button>

        {isEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            {hasRule && (
              <Button danger icon={<TbCalendarOff />} onClick={handleDeleteOccurrence} style={{ flex: 1 }}>
                Delete this occurrence
              </Button>
            )}
            <Button danger icon={<TbTrash />} onClick={handleDeleteSeries} style={{ flex: 1 }}>
              {hasRule ? "Delete series" : "Delete"}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
