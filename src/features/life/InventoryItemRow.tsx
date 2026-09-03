import { Button } from "antd";
import { TbMinus, TbPlus, TbAlertTriangle } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { adjustQuantity, isRunningLow } from "../../lib/inventory";
import type { InventoryItemDto } from "../../db/types";

interface Props {
  item: InventoryItemDto;
  onEdit: () => void;
}

export function InventoryItemRow({ item, onEdit }: Props) {
  const tokens = useTokens();
  const low = isRunningLow(item);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      border: "1px solid var(--border)", borderRadius: 12,
      borderLeft: `3px solid ${low ? tokens.gold : tokens.teal}`,
    }}>
      <div onClick={onEdit} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 12, color: low ? "var(--gold)" : "var(--ink-soft)" }}>
          {item.category && <span>{item.category}</span>}
          {low && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <TbAlertTriangle size={12} /> Running low
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Button size="small" type="text" icon={<TbMinus size={13} />} onClick={() => void adjustQuantity(item.id!, -1)} aria-label={`Decrease ${item.name}`} />
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, minWidth: 36, textAlign: "center" }}>
          {item.quantity}{item.unit ? ` ${item.unit}` : ""}
        </span>
        <Button size="small" type="text" icon={<TbPlus size={13} />} onClick={() => void adjustQuantity(item.id!, 1)} aria-label={`Increase ${item.name}`} />
      </div>
    </div>
  );
}
