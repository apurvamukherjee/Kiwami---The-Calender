import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Button, Input, InputNumber, Segmented, Switch, Popconfirm, App } from "antd";
import { TbTrash, TbPlus, TbX, TbRepeat } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { TimeSelect } from "../../components/TimeSelect";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { createMedication, updateMedication, deleteMedicationForever, setMedicationActive } from "../../lib/medications";
import type { MedicationDto, MedicationScheduleType, TaskRecurrenceDto, RecurrenceType } from "../../db/types";

interface Props {
  open: boolean;
  onClose: () => void;
  medication?: MedicationDto | null; // present -> edit mode; absent -> create mode
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function MedicationEditorSheet({ open, onClose, medication }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const { message } = App.useApp();
  const isEdit = !!medication;

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [form, setForm] = useState("");
  const [scheduleType, setScheduleType] = useState<MedicationScheduleType>("scheduled");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [repeat, setRepeat] = useState<RecurrenceType>("daily");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customInterval, setCustomInterval] = useState(2);
  const [customUnit, setCustomUnit] = useState<"day" | "week">("day");
  const [trackRefill, setTrackRefill] = useState(false);
  const [doseCountRemaining, setDoseCountRemaining] = useState(30);
  const [refillThresholdDays, setRefillThresholdDays] = useState(7);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (medication) {
      setName(medication.name);
      setDosage(medication.dosage ?? "");
      setForm(medication.form ?? "");
      setScheduleType(medication.scheduleType);
      setTimes(medication.times.length > 0 ? medication.times : ["08:00"]);
      setRepeat(medication.recurrence?.type ?? "daily");
      setWeekdays(medication.recurrence?.weekdays ?? []);
      setDayOfMonth(medication.recurrence?.dayOfMonth ?? 1);
      setCustomInterval(medication.recurrence?.interval ?? 2);
      setCustomUnit(medication.recurrence?.customUnit ?? "day");
      setTrackRefill(medication.doseCountRemaining != null);
      setDoseCountRemaining(medication.doseCountRemaining ?? 30);
      setRefillThresholdDays(medication.refillThresholdDays ?? 7);
      setNotes(medication.notes ?? "");
    } else {
      setName("");
      setDosage("");
      setForm("");
      setScheduleType("scheduled");
      setTimes(["08:00"]);
      setRepeat("daily");
      setWeekdays([]);
      setDayOfMonth(1);
      setCustomInterval(2);
      setCustomUnit("day");
      setTrackRefill(false);
      setDoseCountRemaining(30);
      setRefillThresholdDays(7);
      setNotes("");
    }
  }, [open, medication]);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }
  function addTime() {
    setTimes((prev) => [...prev, "12:00"]);
  }
  function removeTime(i: number) {
    setTimes((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateTimeAt(i: number, next: string) {
    setTimes((prev) => prev.map((t, idx) => (idx === i ? next : t)));
  }

  async function handleSave() {
    if (!name.trim()) return;
    // A "weekly" recurrence with zero weekdays selected can never produce an
    // occurrence (expandOccurrences' weekly branch no-ops on an empty
    // weekdays set) — for a medication that means it silently never shows as
    // due and never gets a missed/refill sweep. Defaulting to today's
    // weekday here is the last line of defense; the repeat-button onClick
    // below already does the same so this should rarely actually fire.
    const safeWeekdays = weekdays.length > 0 ? weekdays : [dayjs().day()];
    const recurrence: TaskRecurrenceDto | null =
      scheduleType === "scheduled"
        ? {
            type: repeat,
            weekdays: repeat === "weekly" ? safeWeekdays : undefined,
            dayOfMonth: repeat === "monthly" ? dayOfMonth : undefined,
            interval: repeat === "custom" ? customInterval : undefined,
            customUnit: repeat === "custom" ? customUnit : undefined,
            endDate: null,
            excludedDates: [],
          }
        : null;

    const patch = {
      name: name.trim(),
      dosage: dosage.trim() || undefined,
      form: form.trim() || undefined,
      scheduleType,
      recurrence,
      times: scheduleType === "scheduled" ? times.filter(Boolean) : [],
      doseCountRemaining: trackRefill ? doseCountRemaining : undefined,
      refillThresholdDays: trackRefill ? refillThresholdDays : undefined,
      notes: notes.trim() || undefined,
    };

    if (isEdit && medication?.id) {
      await updateMedication(medication.id, patch);
    } else {
      await createMedication(patch);
    }
    message.success(isEdit ? "Medication updated" : "Medication added");
    onClose();
  }

  async function handleDelete() {
    if (!medication?.id) return;
    await deleteMedicationForever(medication.id);
    message.success("Medication removed");
    onClose();
  }

  async function handlePauseToggle() {
    if (!medication?.id) return;
    await setMedicationActive(medication.id, !medication.active);
    message.success(medication.active ? "Paused" : "Resumed");
    onClose();
  }

  return (
    <Sheet
      open={open} onCancel={onClose} footer={null} title={isEdit ? "Edit medication" : "Add medication"}
      mobileFullHeight styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onPressEnter={handleSave} autoFocus />
        <div style={{ display: "flex", gap: 8 }}>
          <Input placeholder="Dosage (e.g. 500mg)" value={dosage} onChange={(e) => setDosage(e.target.value)} />
          <Input placeholder="Form (e.g. tablet)" value={form} onChange={(e) => setForm(e.target.value)} />
        </div>

        <Segmented
          block value={scheduleType} onChange={(v) => setScheduleType(v as MedicationScheduleType)}
          options={[{ label: "Scheduled", value: "scheduled" }, { label: "As needed (PRN)", value: "prn" }]}
        />

        {scheduleType === "scheduled" && (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Times</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {times.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <TimeSelect value={t} onChange={(next) => updateTimeAt(i, next)} size="small" />
                    {times.length > 1 && (
                      <Button size="small" type="text" icon={<TbX size={13} />} onClick={() => removeTime(i)} aria-label="Remove time" />
                    )}
                  </div>
                ))}
              </div>
              <Button size="small" type="text" icon={<TbPlus size={13} />} onClick={addTime} style={{ marginTop: 4 }}>
                Add another time
              </Button>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <TbRepeat size={14} /> Repeats
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["daily", "weekly", "monthly", "custom"] as RecurrenceType[]).map((r) => (
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
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Track refill count</span>
              <Switch size="small" checked={trackRefill} onChange={setTrackRefill} />
            </div>
            {trackRefill && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Doses left</span>
                  <InputNumber size="small" min={0} value={doseCountRemaining} onChange={(v) => setDoseCountRemaining(v ?? 0)} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Alert at</span>
                  <InputNumber size="small" min={1} value={refillThresholdDays} onChange={(v) => setRefillThresholdDays(v ?? 1)} />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>days left</span>
                </div>
              </div>
            )}
          </>
        )}

        <Input.TextArea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <Button type="primary" onClick={handleSave}>{isEdit ? "Save" : "Add medication"}</Button>

        {isEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={handlePauseToggle}>{medication?.active ? "Pause" : "Resume"}</Button>
            <Popconfirm
              title="Remove this medication?"
              description="Its dose history is removed too. This can't be undone."
              okText="Remove" okButtonProps={{ danger: true }}
              onConfirm={handleDelete}
            >
              <Button danger icon={<TbTrash />} style={{ flex: 1 }}>Remove</Button>
            </Popconfirm>
          </div>
        )}
      </div>
    </Sheet>
  );
}
