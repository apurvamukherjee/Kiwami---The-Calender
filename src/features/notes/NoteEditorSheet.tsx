import { useEffect, useState } from "react";
import { Button, Input, Segmented, Switch, Popconfirm, App, Tag } from "antd";
import dayjs from "dayjs";
import { TbTrash, TbListCheck, TbBell, TbMapPin, TbLink, TbPlus } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { TimeSelect } from "../../components/TimeSelect";
import { useBackClose } from "../../hooks/useBackClose";
import { updateNote, deleteNote } from "../../lib/notes";
import { combineDateTime, todayKey } from "../../lib/date.utils";
import { hapticLight, hapticSuccess } from "../../lib/haptics";
import type { NoteDto, NoteKind } from "../../db/types";

// Task/Reminder only — a plain "note" is edited full-screen in
// NoteFullEditor instead (see NotesPage.tsx/CalendarPage.tsx's routing by
// kind), so this sheet never offers switching into it.
const KIND_OPTIONS = [
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}><TbListCheck size={13} /> Task</span>, value: "task" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}><TbBell size={13} /> Reminder</span>, value: "reminder" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  note: NoteDto | null;
}

// Tapping an existing Note/Task/Reminder opens this — same
// save/Popconfirm-delete/toast pattern as EventEditorSheet.tsx.
export function NoteEditorSheet({ open, onClose, note }: Props) {
  useBackClose(open, onClose);
  const { message } = App.useApp();

  const [kind, setKind] = useState<NoteKind>("note");
  const [title, setTitle] = useState("");
  const [hasDate, setHasDate] = useState(false);
  const [dueDate, setDueDate] = useState(todayKey());
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [manualLink, setManualLink] = useState("");

  useEffect(() => {
    if (!open || !note) return;
    setKind(note.kind);
    setTitle(note.title);
    setHasDate(!!note.dueDate);
    setDueDate(note.dueDate ? note.dueDate.slice(0, 10) : todayKey());
    setAllDay(!!note.allDay);
    setTime(note.dueDate ? dayjs(note.dueDate).format("HH:mm") : "09:00");
    setLocation(note.location ?? "");
    setDescription(note.description ?? "");
    setLinks(note.links ?? []);
  }, [open, note]);

  function addManualLink() {
    const v = manualLink.trim();
    if (!v) return;
    setLinks((prev) => [...prev, v]);
    setManualLink("");
  }

  async function handleSave() {
    if (!note?.id || !title.trim()) return;
    await updateNote(note.id, {
      kind,
      title: title.trim(),
      dueDate: hasDate ? combineDateTime(dueDate, allDay ? "00:00" : time) : undefined,
      allDay: hasDate ? allDay : undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      links: links.length ? links : undefined,
    });
    hapticSuccess();
    message.success("Saved");
    onClose();
  }

  async function handleDelete() {
    if (!note?.id) return;
    await deleteNote(note.id);
    hapticLight();
    message.success("Deleted");
    onClose();
  }

  return (
    <Sheet open={open} onCancel={onClose} footer={null} title="Edit" styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        <Segmented block value={kind} onChange={(v) => setKind(v as NoteKind)} options={KIND_OPTIONS} />

        <Input.TextArea placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoSize={{ minRows: 1, maxRows: 4 }} autoFocus />

        {kind !== "note" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Has a date</span>
            <Switch size="small" checked={hasDate} onChange={setHasDate} />
          </div>
        )}
        {kind !== "note" && hasDate && (
          <>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", width: "100%" }} />
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
          </>
        )}

        <Input placeholder="Location (optional)" prefix={<TbMapPin size={14} style={{ color: "var(--ink-soft)" }} />}
          value={location} onChange={(e) => setLocation(e.target.value)} />
        <Input.TextArea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

        <div style={{ display: "flex", gap: 6 }}>
          <Input placeholder="Add a link" prefix={<TbLink size={14} style={{ color: "var(--ink-soft)" }} />} value={manualLink}
            onChange={(e) => setManualLink(e.target.value)} onPressEnter={addManualLink} />
          <Button icon={<TbPlus size={14} />} onClick={addManualLink} />
        </div>
        {links.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {links.map((l, i) => (
              <Tag key={l + i} closable onClose={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}>{l}</Tag>
            ))}
          </div>
        )}

        <Button type="primary" onClick={handleSave}>Save</Button>

        <Popconfirm title="Delete this?" description="This can't be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={handleDelete}>
          <Button danger icon={<TbTrash />}>Delete</Button>
        </Popconfirm>
      </div>
    </Sheet>
  );
}
