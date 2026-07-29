import { useMemo } from "react";
import dayjs from "dayjs";
import { TbFlame, TbToolsKitchen2, TbRepeat } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { todayKey } from "../../lib/date.utils";
import { eventColor } from "./timeGrid";
import { EmberChain } from "../../components/EmberChain";
import { useRecentBeads } from "../routines/useRoutineStreak";
import type { CalendarItem } from "./useCalendarEvents";

const AGENDA_CHAIN_DAYS = 7;

// Agenda rows have the horizontal room a Month/Week/Day cell doesn't — this
// is the one place besides the routine detail sheet where the Ember Chain
// itself (not just a single done/missed dot) appears, a quick "how's this
// routine been going" glance without opening the detail sheet.
function RoutineChainBadge({ eventId }: { eventId: number | undefined }) {
  const beads = useRecentBeads(eventId, AGENDA_CHAIN_DAYS);
  return <EmberChain beads={beads} size="compact" />;
}

interface Props {
  items: CalendarItem[];
  onTapItem: (item: CalendarItem) => void;
}

// Chronological list grouped by day. Days with nothing on them are skipped
// entirely (matches how every mainstream agenda view behaves) rather than
// rendering an empty header for every date in the window.
export function AgendaView({ items, onTapItem }: Props) {
  const tokens = useTokens();
  const today = todayKey();

  const groups = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const arr = map.get(it.date);
      if (arr) arr.push(it);
      else map.set(it.date, [it]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayItems]) => [date, [...dayItems].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))] as const);
  }, [items]);

  if (groups.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>
        Nothing on the calendar in this window.
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {groups.map(([date, dayItems]) => (
        <div key={date}>
          <div style={{
            position: "sticky", top: 0, zIndex: 2, background: "var(--bg)",
            padding: "8px 20px", fontSize: 12, fontWeight: 800, color: "var(--ink-soft)",
            borderBottom: "1px solid var(--border)",
          }}>
            {dayjs(date).format("dddd, D MMMM")}{date === today ? " · Today" : ""}
          </div>
          {dayItems.map((it, i) => {
            const color = eventColor(it.event, tokens);
            const missed = it.occurrenceStatus?.status === "missed";
            const done = it.occurrenceStatus?.status === "done";
            return (
              <div
                key={i}
                onClick={() => onTapItem(it)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer",
                  borderLeft: `3px solid ${color}`, opacity: done || missed ? 0.6 : 1,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ width: 56, flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
                  {it.event.allDay ? "All day" : it.time}
                </div>
                {it.event.isRoutine ? <TbFlame size={15} style={{ color, flexShrink: 0 }} />
                  : it.event.isFoodSlot ? <TbToolsKitchen2 size={15} style={{ color, flexShrink: 0 }} />
                  : it.rule ? <TbRepeat size={15} style={{ color: "var(--ink-soft)", flexShrink: 0 }} /> : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, textDecoration: missed ? "line-through" : "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {it.event.title}
                  </div>
                  {it.event.location && (
                    <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{it.event.location}</div>
                  )}
                </div>
                {it.event.isRoutine && <RoutineChainBadge eventId={it.event.id} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
