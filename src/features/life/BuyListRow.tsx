import { Checkbox } from "antd";
import { useTokens } from "../../hooks/useTokens";
import { markBought } from "../../lib/shopping";
import { hapticLight } from "../../lib/haptics";
import type { BuyListItemDto } from "../../db/types";

interface Props {
  item: BuyListItemDto;
  onEdit: () => void;
}

export function BuyListRow({ item, onEdit }: Props) {
  const tokens = useTokens();
  const urgent = item.urgency === "now" && !item.bought;

  async function toggle(checked: boolean) {
    hapticLight();
    await markBought(item.id!, checked);
  }

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
      border: "1px solid var(--border)", borderRadius: 12,
      borderLeft: `3px solid ${urgent ? tokens.gold : tokens.teal}`,
      opacity: item.bought ? 0.55 : 1,
    }}>
      <span onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
        <Checkbox checked={item.bought} onChange={(e) => void toggle(e.target.checked)} />
      </span>
      <div onClick={onEdit} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontWeight: 700, fontSize: 14, textDecoration: item.bought ? "line-through" : "none" }}>{item.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 12, color: urgent ? "var(--gold)" : "var(--ink-soft)" }}>
          {item.store && <span>{item.store}</span>}
          {urgent && <span>Now</span>}
          {item.manualPrice != null && <span style={{ fontFamily: "var(--font-mono)" }}>~{item.manualPrice}</span>}
        </div>
      </div>
    </div>
  );
}
