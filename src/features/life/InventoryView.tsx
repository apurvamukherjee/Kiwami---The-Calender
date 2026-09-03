import { useState } from "react";
import { Button, Switch, Empty } from "antd";
import { TbPlus, TbBox } from "react-icons/tb";
import { useInventoryItems, isRunningLow } from "../../lib/inventory";
import { InventoryItemRow } from "./InventoryItemRow";
import { InventoryEditorSheet } from "./InventoryEditorSheet";
import type { InventoryItemDto } from "../../db/types";

export function InventoryView() {
  const [lowOnly, setLowOnly] = useState(false);
  const items = useInventoryItems();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemDto | null>(null);

  const visible = lowOnly ? items.filter(isRunningLow) : items;

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(item: InventoryItemDto) {
    setEditing(item);
    setEditorOpen(true);
  }

  return (
    <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Button icon={<TbPlus size={14} />} size="small" type="primary" onClick={openCreate}>Add item</Button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Running low only</span>
          <Switch size="small" checked={lowOnly} onChange={setLowOnly} />
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty
          image={<TbBox size={32} style={{ opacity: 0.4, margin: "0 auto" }} />}
          description={items.length === 0 ? "No inventory items yet" : "Nothing running low"}
          style={{ marginTop: 48 }}
        />
      ) : (
        visible.map((item) => <InventoryItemRow key={item.id} item={item} onEdit={() => openEdit(item)} />)
      )}

      <InventoryEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} item={editing} />
    </div>
  );
}
