import { motion, useReducedMotion } from "framer-motion";
import { TbCalendarEvent, TbNotes, TbListCheck, TbLayoutDashboard } from "react-icons/tb";
import { hapticLight } from "../lib/haptics";

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

// Mobile-only 4-tab dock. A normal flex child (not position:fixed) in App.tsx's
// column layout — flexbox reserves its height automatically, so no page ever
// needs manual bottom-padding math to avoid hiding content behind it.
// The active tab is marked by a single gradient pill shared across all four
// buttons via framer-motion's `layoutId`, so switching tabs slides one element
// rather than cross-fading four.
export function BottomNav({ section, onChange }: Props) {
  const reduce = useReducedMotion();
  return (
    <div className="safe-bottom kiwami-dock" style={{ display: "flex", flexShrink: 0, padding: "6px 8px 2px", gap: 4 }}>
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const active = section === key;
        return (
          <button
            key={key}
            onClick={() => { hapticLight(); onChange(key); }}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            style={{
              position: "relative", flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3, padding: "8px 0 7px", background: "transparent",
              border: "none", cursor: "pointer", borderRadius: 14,
              color: active ? "#fff" : "var(--ink-soft)",
              transition: "color 0.22s var(--ease)",
            }}
          >
            {active && (
              <motion.span
                layoutId="dock-pill"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                style={{
                  position: "absolute", inset: 0, borderRadius: 14, zIndex: 0,
                  background: "var(--accent-gradient)",
                  boxShadow: "0 4px 16px var(--ember-glow)",
                }}
              />
            )}
            <Icon size={20} style={{ position: "relative", zIndex: 1 }} />
            <span style={{ position: "relative", zIndex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.01em" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
