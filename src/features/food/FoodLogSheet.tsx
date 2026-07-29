import dayjs from "dayjs";
import { Button } from "antd";
import { TbCheck, TbX, TbToolsKitchen2 } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { setOccurrenceStatus, useOccurrenceStatus } from "../../lib/occurrences";
import { hapticSuccess, hapticLight } from "../../lib/haptics";
import type { CalendarItem } from "../calendar/useCalendarEvents";

interface Props {
  open: boolean;
  onClose: () => void;
  item: CalendarItem | null;
  onEdit: (item: CalendarItem) => void;
}

// The lightweight one-tap log surface for food slots — no streak, no chain
// (food adherence isn't tracked as a streak per spec), just today's
// ate/skipped call, labeled accordingly even though the stored enum is the
// same pending/done/missed the routine side uses.
export function FoodLogSheet({ open, onClose, item, onEdit }: Props) {
  useBackClose(open, onClose);
  const eventId = item?.event.id;
  const status = useOccurrenceStatus(eventId, item?.date);

  async function mark(next: "done" | "missed") {
    if (eventId == null || !item) return;
    await setOccurrenceStatus(eventId, item.date, next);
    if (next === "done") hapticSuccess();
    else hapticLight();
  }

  if (!item) return null;

  return (
    <Sheet open={open} onCancel={onClose} footer={null} title={item.event.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "8px 0 4px" }}>
        <TbToolsKitchen2 size={28} style={{ color: "var(--teal)" }} />
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {dayjs(item.date).format("dddd, D MMMM")} · {item.time}
          {" · "}
          {status === "done" ? "Ate" : status === "missed" ? "Skipped" : "Not yet logged"}
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <Button block size="large" type={status === "done" ? "primary" : "default"} icon={<TbCheck />} onClick={() => mark("done")}>
            Ate
          </Button>
          <Button block size="large" danger type={status === "missed" ? "primary" : "default"} icon={<TbX />} onClick={() => mark("missed")}>
            Skipped
          </Button>
        </div>
        <Button type="text" onClick={() => { onClose(); onEdit(item); }}>Edit slot</Button>
      </div>
    </Sheet>
  );
}
