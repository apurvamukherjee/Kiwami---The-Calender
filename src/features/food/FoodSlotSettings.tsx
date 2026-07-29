import { useState } from "react";
import dayjs from "dayjs";
import { Button, Input } from "antd";
import { TbTrash, TbPlus, TbToolsKitchen2 } from "react-icons/tb";
import { TimeSelect } from "../../components/TimeSelect";
import { useFoodSlots, addFoodSlot, renameFoodSlot, retimeFoodSlot, removeFoodSlot } from "./useFoodSlots";
import type { EventDto } from "../../db/types";

export function FoodSlotSettings() {
  const slots = useFoodSlots();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("08:00");

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await addFoodSlot(newTitle.trim(), newTime);
    setNewTitle("");
    setNewTime("08:00");
    setAdding(false);
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <TbToolsKitchen2 size={15} style={{ color: "var(--teal)" }} /> Food-time slots
      </div>

      {slots.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>
          No slots yet — add Breakfast, Lunch, Dinner, or any snack times you want to track.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {slots.map((slot) => (
          <FoodSlotRow key={slot.id} slot={slot} />
        ))}
      </div>

      {adding ? (
        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
          <Input placeholder="Name" size="small" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 1 }} onPressEnter={handleAdd} autoFocus />
          <TimeSelect value={newTime} onChange={setNewTime} size="small" />
          <Button size="small" type="primary" onClick={handleAdd}>Add</Button>
          <Button size="small" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      ) : (
        <Button size="small" icon={<TbPlus size={13} />} onClick={() => setAdding(true)} style={{ marginTop: 10 }}>
          Add slot
        </Button>
      )}
    </div>
  );
}

function FoodSlotRow({ slot }: { slot: EventDto }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(slot.title);
  const [time, setTime] = useState(dayjs(slot.startTime).format("HH:mm"));

  async function save() {
    if (!slot.id) return;
    if (title.trim() && title.trim() !== slot.title) await renameFoodSlot(slot.id, title.trim());
    if (time !== dayjs(slot.startTime).format("HH:mm")) await retimeFoodSlot(slot.id, time);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 0" }}>
        <Input size="small" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} onPressEnter={save} autoFocus />
        <TimeSelect value={time} onChange={setTime} size="small" />
        <Button size="small" type="primary" onClick={save}>Save</Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <div onClick={() => setEditing(true)} style={{ flex: 1, cursor: "pointer" }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{slot.title}</span>
        <span style={{ fontSize: 12, color: "var(--ink-soft)", marginLeft: 8 }}>{dayjs(slot.startTime).format("HH:mm")}</span>
      </div>
      <Button size="small" type="text" danger icon={<TbTrash size={14} />} onClick={() => slot.id && removeFoodSlot(slot.id)} />
    </div>
  );
}
