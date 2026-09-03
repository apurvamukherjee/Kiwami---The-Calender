import { TbCalendarEvent, TbNotes, TbListCheck, TbLayoutDashboard } from "react-icons/tb";

export type Section = "calendar" | "notes" | "tasks" | "life";

interface Props {
  section: Section;
  onChange: (s: Section) => void;
}

const ITEMS: { key: Section; label: string; icon: typeof TbCalendarEvent }[] = [
  { key: "calendar", label: "Calendar", icon: TbCalendarEvent },
  { key: "notes", label: "Notes", icon: TbNotes },
  { key: "tasks", label: "Tasks", icon: TbListCheck },
  { key: "life", label: "Life", icon: TbLayoutDashboard },
];

// Mobile-only 2-tab bar. A normal flex child (not position:fixed) in App.tsx's
// column layout — flexbox reserves its height automatically, so no page ever
// needs manual bottom-padding math to avoid hiding content behind it.
export function BottomNav({ section, onChange }: Props) {
  return (
    <div className="safe-bottom" style={{
      display: "flex", flexShrink: 0, borderTop: "1px solid var(--border)",
      background: "var(--toolbar-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const active = section === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "8px 0 6px", background: "transparent", border: "none", cursor: "pointer",
              color: active ? "var(--accent)" : "var(--ink-soft)",
            }}
          >
            <Icon size={21} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
