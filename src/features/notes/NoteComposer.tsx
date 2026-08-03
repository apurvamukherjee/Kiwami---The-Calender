import { useState } from "react";
import { Input, Segmented, Switch, Button, Tag } from "antd";
import { TbNote, TbListCheck, TbBell, TbCalendar, TbX, TbMapPin, TbLink, TbChevronDown, TbChevronUp, TbPlus } from "react-icons/tb";
import dayjs from "dayjs";
import { TimeSelect } from "../../components/TimeSelect";
import { parseNoteText } from "../../lib/parseNoteText";
import { createNote } from "../../lib/notes";
import { requestNotificationPermission } from "../../lib/notifications";
import { combineDateTime, todayKey } from "../../lib/date.utils";
import { hapticSuccess } from "../../lib/haptics";
import type { NoteKind } from "../../db/types";

const KIND_OPTIONS = [
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbNote size={14} /> Note</span>, value: "note" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbListCheck size={14} /> Task</span>, value: "task" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbBell size={14} /> Reminder</span>, value: "reminder" },
];

const PLACEHOLDERS: Record<NoteKind, string> = {
  note: "Write a note…",
  task: "Add a task — try \"pack bags tomorrow 9am\"",
  reminder: "Set a reminder — try \"call the dentist friday 2pm\"",
};

// Sticky quick-entry bar pinned atop NotesPage. Text is live-parsed on every
// keystroke via parseNoteText (chrono-node, runs fully offline) so a date/
// time chip appears as you type — never silently trusted, always editable/
// dismissible via the fields below it. Manually editing the date detaches it
// from further live-parsing (dateOverridden) so typing more text afterward
// doesn't stomp a correction.
export function NoteComposer() {
  const [kind, setKind] = useState<NoteKind>("note");
  const [rawText, setRawText] = useState("");
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  const [allDay, setAllDay] = useState(false);
  const [dateOverridden, setDateOverridden] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [manualLinks, setManualLinks] = useState<string[]>([]);

  function onTextChange(text: string) {
    setRawText(text);
    const parsed = parseNoteText(text);
    setLinks(parsed.links);
    if (!dateOverridden) {
      setDueDate(parsed.dueDate);
      setAllDay(parsed.allDay);
    }
  }

  function clearDate() {
    setDueDate(undefined);
    setDateOverridden(false);
    // Re-parse immediately so clearing doesn't fight the next keystroke.
    const parsed = parseNoteText(rawText);
    setDueDate(parsed.dueDate);
    setAllDay(parsed.allDay);
  }

  function setDatePart(dateKey: string) {
    setDateOverridden(true);
    const timeKey = dueDate ? dayjs(dueDate).format("HH:mm") : "09:00";
    setDueDate(combineDateTime(dateKey, allDay ? "00:00" : timeKey));
  }
  function setTimePart(timeKey: string) {
    setDateOverridden(true);
    setDueDate(combineDateTime(dueDate ? dueDate.slice(0, 10) : todayKey(), timeKey));
  }
  function setAllDayPart(v: boolean) {
    setDateOverridden(true);
    setAllDay(v);
    if (dueDate) setDueDate(combineDateTime(dueDate.slice(0, 10), v ? "00:00" : "09:00"));
  }

  function addManualLink() {
    const v = manualLink.trim();
    if (!v) return;
    setManualLinks((prev) => [...prev, v]);
    setManualLink("");
  }

  async function handleSave() {
    const parsed = parseNoteText(rawText);
    const title = parsed.title;
    if (!title.trim()) return;
    const allLinks = [...new Set([...links, ...manualLinks])];

    if (kind === "reminder") void requestNotificationPermission();

    await createNote({
      kind,
      title: title.trim(),
      rawText,
      description: description.trim() || undefined,
      dueDate,
      allDay,
      location: location.trim() || undefined,
      links: allLinks.length ? allLinks : undefined,
    });

    hapticSuccess();
    setRawText("");
    setDueDate(undefined);
    setAllDay(false);
    setDateOverridden(false);
    setLinks([]);
    setLocation("");
    setDescription("");
    setManualLinks([]);
    setExpanded(false);
  }

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--toolbar-bg)" }}>
      <Segmented block size="small" value={kind} onChange={(v) => setKind(v as NoteKind)} options={KIND_OPTIONS} style={{ marginBottom: 10 }} />

      <Input.TextArea
        placeholder={PLACEHOLDERS[kind]}
        value={rawText}
        onChange={(e) => onTextChange(e.target.value)}
        onPressEnter={(e) => { e.preventDefault(); void handleSave(); }}
        autoSize={{ minRows: 1, maxRows: 4 }}
      />

      {(dueDate || links.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {dueDate && (
            <Tag icon={<TbCalendar size={12} style={{ verticalAlign: -1 }} />} closable closeIcon={<TbX size={11} />} onClose={clearDate} color="var(--accent)">
              {allDay ? dayjs(dueDate).format("D MMM") : dayjs(dueDate).format("D MMM, HH:mm")}
            </Tag>
          )}
          {links.map((l) => (
            <Tag key={l} icon={<TbLink size={12} style={{ verticalAlign: -1 }} />}>{l.length > 28 ? l.slice(0, 28) + "…" : l}</Tag>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <Button type="text" size="small" onClick={() => setExpanded((v) => !v)} icon={expanded ? <TbChevronUp size={14} /> : <TbChevronDown size={14} />}>
          Details
        </Button>
        <Button type="primary" size="small" onClick={handleSave} disabled={!rawText.trim()}>Add</Button>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {kind !== "note" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="date"
                  value={dueDate ? dueDate.slice(0, 10) : todayKey()}
                  onChange={(e) => setDatePart(e.target.value)}
                  style={{ padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)" }}
                />
                {!allDay && <TimeSelect size="small" value={dueDate ? dayjs(dueDate).format("HH:mm") : "09:00"} onChange={setTimePart} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>All-day</span>
                <Switch size="small" checked={allDay} onChange={setAllDayPart} />
              </div>
            </div>
          )}

          <Input placeholder="Location (optional)" prefix={<TbMapPin size={14} style={{ color: "var(--ink-soft)" }} />} value={location} onChange={(e) => setLocation(e.target.value)} />
          <Input.TextArea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

          <div style={{ display: "flex", gap: 6 }}>
            <Input placeholder="Add a link" prefix={<TbLink size={14} style={{ color: "var(--ink-soft)" }} />} value={manualLink}
              onChange={(e) => setManualLink(e.target.value)} onPressEnter={addManualLink} />
            <Button icon={<TbPlus size={14} />} onClick={addManualLink} />
          </div>
          {manualLinks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {manualLinks.map((l, i) => (
                <Tag key={l + i} closable onClose={() => setManualLinks((prev) => prev.filter((_, idx) => idx !== i))}>{l}</Tag>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
