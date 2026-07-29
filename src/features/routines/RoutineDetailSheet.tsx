import dayjs from "dayjs";
import { Button } from "antd";
import { TbCheck, TbX, TbFlame } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { EmberChain, STREAK_MILESTONES } from "../../components/EmberChain";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { useRecentBeads, useStreakCount } from "./useRoutineStreak";
import { setOccurrenceStatus, useOccurrenceStatus } from "../../lib/occurrences";
import { hapticSuccess, hapticLight } from "../../lib/haptics";
import { todayKey } from "../../lib/date.utils";
import type { CalendarItem } from "../calendar/useCalendarEvents";

const HISTORY_DAYS = 21;

interface Props {
  open: boolean;
  onClose: () => void;
  item: CalendarItem | null;
  onEdit: (item: CalendarItem) => void;
}

// The per-occurrence action surface for a routine: the full Ember Chain +
// streak number, and explicit Done/Missed buttons (deliberately not a silent
// tap-to-cycle — an accidental tap shouldn't be able to break a streak).
export function RoutineDetailSheet({ open, onClose, item, onEdit }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const eventId = item?.event.id;
  const beads = useRecentBeads(eventId, HISTORY_DAYS);
  const streak = useStreakCount(eventId);
  const status = useOccurrenceStatus(eventId, item?.date);
  const isToday = item?.date === todayKey();

  async function mark(next: "done" | "missed") {
    if (eventId == null || !item) return;
    await setOccurrenceStatus(eventId, item.date, next);
    if (next === "done") hapticSuccess();
    else hapticLight();
  }

  if (!item) return null;

  return (
    <Sheet
      open={open}
      onCancel={onClose}
      footer={null}
      title={item.event.title}
      styles={{
        content: { background: `${tokens.surfaceLowest}e6`, backdropFilter: "blur(20px)" },
        header: { background: "transparent" },
      }}
    >
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "8px 0 4px" }}>
        {/* Decorative gradient bloom — the "Floating Blade" hero-panel accent. */}
        <div style={{
          position: "absolute", top: -80, right: -80, width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${tokens.accent}22, transparent 70%)`,
          filter: "blur(40px)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <TbFlame size={24} style={{ color: "var(--accent)" }} />
              <span style={{
                fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 900, letterSpacing: "-0.02em",
                lineHeight: 1.1, fontVariantNumeric: "tabular-nums", color: "var(--ink)",
              }}>{streak}</span>
            </div>
            <span className="label-caps" style={{ color: "var(--ink-soft)" }}>Day streak</span>
          </div>

          <EmberChain beads={beads} size="full" milestoneStreak={streak} />

          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.03em", color: "var(--ink-soft)" }}>
            {dayjs(item.date).format("dddd, D MMMM")} ·{" "}
            {status === "done" ? "Done" : status === "missed" ? "Missed" : "Not yet marked"}
          </div>

          {STREAK_MILESTONES.includes(streak) && status === "done" && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--diamond)" }}>
              💎 {streak}-day milestone!
            </div>
          )}

          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <Button
              block size="large" type={status === "done" ? "primary" : "default"} icon={<TbCheck />} onClick={() => mark("done")}
              style={{ borderRadius: 14, boxShadow: status === "done" ? `0 0 20px ${tokens.accent}55` : undefined }}
            >
              Done
            </Button>
            <Button
              block size="large" danger type={status === "missed" ? "primary" : "default"} icon={<TbX />} onClick={() => mark("missed")}
              style={{ borderRadius: 14 }}
            >
              Missed
            </Button>
          </div>

          {!isToday && (
            <div style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
              Editing a past occurrence — this can change the streak count.
            </div>
          )}

          <Button type="text" onClick={() => { onClose(); onEdit(item); }}>
            Edit series / delete
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
