import dayjs from "dayjs";
import { Checkbox } from "antd";
import { TbRepeat, TbHistory } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { completeChore } from "../../lib/chores";
import { hapticLight } from "../../lib/haptics";
import { todayKey } from "../../lib/date.utils";
import type { ChoreDto } from "../../db/types";

interface Props {
  chore: ChoreDto;
  onEdit: () => void;
}

// Flat checkbox row, deliberately not a Kanban card — chores are a simple
// due/done list, not a board. No streak/Ember Chain here on purpose (per
// LIFE_TAB_FEATURE_PLAN.md §9: chores stay completion-based, not habit-based,
// to avoid streak clutter for something you'd do anyway).
export function ChoreCard({ chore, onEdit }: Props) {
  const tokens = useTokens();
  const overdue = !!chore.dueDate && !chore.completed && chore.dueDate.slice(0, 10) < todayKey();

  async function toggle(checked: boolean) {
    hapticLight();
    await completeChore(chore.id!, checked);
  }

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
      border: "1px solid var(--border)", borderRadius: 12,
      borderLeft: `3px solid ${overdue ? tokens.gold : tokens.teal}`,
      opacity: chore.completed ? 0.55 : 1,
    }}>
      <span onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
        <Checkbox checked={chore.completed} onChange={(e) => void toggle(e.target.checked)} />
      </span>
      <div onClick={onEdit} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontWeight: 700, fontSize: 14, textDecoration: chore.completed ? "line-through" : "none" }}>
          {chore.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 12, color: overdue ? "var(--gold)" : "var(--ink-soft)" }}>
          {chore.dueDate && <span style={{ fontFamily: "var(--font-mono)" }}>{dayjs(chore.dueDate).format("D MMM")}</span>}
          {chore.recurrence && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <TbRepeat size={12} /> {chore.recurrence.type}
            </span>
          )}
          {chore.rescheduleFromCompletion && (
            <span title="Reschedules from when you actually complete it" style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <TbHistory size={12} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
