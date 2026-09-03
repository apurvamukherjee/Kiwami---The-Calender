import { Segmented } from "antd";
import { TbCalendarEvent, TbNotes, TbListCheck, TbLayoutDashboard } from "react-icons/tb";
import type { Section } from "./BottomNav";

interface Props {
  section: Section;
  onChange: (s: Section) => void;
}

// Desktop-only Calendar/Notes switch, dropped into the left edge of each
// page's own toolbar — mobile gets the literal BottomNav instead, desktop
// keeps its existing full-width toolbar shell rather than growing a whole
// new chrome layer just for a 2-way switch.
export function SectionTabs({ section, onChange }: Props) {
  return (
    <Segmented
      size="small"
      value={section}
      onChange={(v) => onChange(v as Section)}
      options={[
        { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbCalendarEvent size={13} /> Calendar</span>, value: "calendar" },
        { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbNotes size={13} /> Notes</span>, value: "notes" },
        { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbListCheck size={13} /> Tasks</span>, value: "tasks" },
        { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbLayoutDashboard size={13} /> Life</span>, value: "life" },
      ]}
    />
  );
}
