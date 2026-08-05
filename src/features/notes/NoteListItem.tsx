import dayjs from "dayjs";
import { Checkbox } from "antd";
import { TbNote, TbListCheck, TbBell, TbMapPin, TbLink } from "react-icons/tb";
import { toggleTaskComplete, htmlToPlainText } from "../../lib/notes";
import { hapticLight } from "../../lib/haptics";
import type { NoteDto } from "../../db/types";

const KIND_ICON = { note: TbNote, task: TbListCheck, reminder: TbBell };
const KIND_COLOR: Record<NoteDto["kind"], string> = { note: "var(--ink-soft)", task: "var(--accent)", reminder: "var(--teal)" };

interface Props {
  note: NoteDto;
  onTap: (note: NoteDto) => void;
  // "time" when a day header already shows the date (Timeline groups); "full"
  // in the flat, ungrouped All feed where each row needs its own date.
  dateFormat?: "time" | "full";
}

// Dispatches to a distinct card look for plain Notes (Apple Notes' gallery
// list — title + body snippet, no checkbox, tap opens the full-screen rich
// editor) vs. the compact checkbox row every Task/Reminder uses.
export function NoteListItem(props: Props) {
  return props.note.kind === "note" ? <NoteCardRow {...props} /> : <ActionRow {...props} />;
}

function NoteCardRow({ note, onTap }: Props) {
  const preview = note.body ? htmlToPlainText(note.body) : note.description ?? "";
  return (
    <div
      onClick={() => onTap(note)}
      style={{
        margin: "8px 16px", padding: "12px 14px", cursor: "pointer",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {note.title || "New note"}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
          {dayjs(note.updatedAt).format("D MMM")}
        </div>
      </div>
      {preview && (
        <div style={{
          fontSize: 12, color: "var(--ink-soft)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {preview}
        </div>
      )}
    </div>
  );
}

// The compact tap-to-toggle row every Task/Reminder uses — mirrors
// AgendaView.tsx's row shape (icon, title, secondary location line) but with
// a real checkbox instead of a status dot, since a task/reminder is a direct
// tap-to-toggle, not a streak-critical explicit Done/Missed action.
function ActionRow({ note, onTap, dateFormat = "time" }: Props) {
  const Icon = KIND_ICON[note.kind];
  const done = !!note.completed;

  return (
    <div
      onClick={() => onTap(note)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 20px", cursor: "pointer",
        borderBottom: "1px solid var(--border)", opacity: done ? 0.55 : 1,
      }}
    >
      <Checkbox
        checked={done}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { hapticLight(); void toggleTaskComplete(note.id!, e.target.checked); }}
        style={{ marginTop: 2 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={13} style={{ color: KIND_COLOR[note.kind], flexShrink: 0 }} />
          <div style={{ fontSize: 13, fontWeight: 700, textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {note.title || "(untitled)"}
          </div>
        </div>
        {note.description && (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {note.description}
          </div>
        )}
        {note.location && (
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <TbMapPin size={11} /> {note.location}
          </div>
        )}
        {!!note.links?.length && (
          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <TbLink size={11} /> {note.links.length === 1 ? note.links[0] : `${note.links.length} links`}
          </div>
        )}
      </div>

      {note.dueDate && (
        <div style={{ width: dateFormat === "full" ? 76 : 56, flexShrink: 0, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
          {dateFormat === "full" ? dayjs(note.dueDate).format("D MMM") : note.allDay ? "All day" : dayjs(note.dueDate).format("HH:mm")}
        </div>
      )}
    </div>
  );
}
