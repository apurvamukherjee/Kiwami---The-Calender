import dayjs from "dayjs";
import { Button } from "antd";
import { TbCheck, TbX, TbFlame } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { EmberChain } from "../../components/EmberChain";
import { useBackClose } from "../../hooks/useBackClose";
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
    <Sheet open={open} onCancel={onClose} footer={null} title={item.event.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", padding: "8px 0 4px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <TbFlame size={22} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 34, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{streak}</span>
          <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 }}>day streak</span>
        </div>

        <EmberChain beads={beads} size="full" />

        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {dayjs(item.date).format("dddd, D MMMM")} ·{" "}
          {status === "done" ? "Done" : status === "missed" ? "Missed" : "Not yet marked"}
        </div>

        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <Button block size="large" type={status === "done" ? "primary" : "default"} icon={<TbCheck />} onClick={() => mark("done")}>
            Done
          </Button>
          <Button block size="large" danger type={status === "missed" ? "primary" : "default"} icon={<TbX />} onClick={() => mark("missed")}>
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
    </Sheet>
  );
}
