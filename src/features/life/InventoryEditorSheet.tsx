import { useEffect, useState } from "react";
import { Button, Input, InputNumber, Switch, Popconfirm, App } from "antd";
import { TbTrash, TbShoppingCart } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { createInventoryItem, updateInventoryItem, deleteInventoryItem, addRunningLowToBuyList } from "../../lib/inventory";
import type { InventoryItemDto } from "../../db/types";

interface Props {
  open: boolean;
  onClose: () => void;
  item?: InventoryItemDto | null; // present -> edit mode; absent -> create mode
}

export function InventoryEditorSheet({ open, onClose, item }: Props) {
  useBackClose(open, onClose);
  const { message } = App.useApp();
  const isEdit = !!item;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const [trackMin, setTrackMin] = useState(false);
  const [minQuantity, setMinQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setCategory(item.category ?? "");
      setQuantity(item.quantity);
      setUnit(item.unit ?? "");
      setTrackMin(item.minQuantity != null);
      setMinQuantity(item.minQuantity ?? 1);
      setNotes(item.notes ?? "");
    } else {
      setName("");
      setCategory("");
      setQuantity(1);
      setUnit("");
      setTrackMin(false);
      setMinQuantity(1);
      setNotes("");
    }
  }, [open, item]);

  async function handleSave() {
    if (!name.trim()) return;
    const patch = {
      name: name.trim(),
      category: category.trim() || undefined,
      quantity,
      unit: unit.trim() || undefined,
      minQuantity: trackMin ? minQuantity : undefined,
      notes: notes.trim() || undefined,
    };
    if (isEdit && item?.id) {
      await updateInventoryItem(item.id, patch);
    } else {
      await createInventoryItem(patch);
    }
    message.success(isEdit ? "Item updated" : "Item added");
    onClose();
  }

  async function handleDelete() {
    if (!item?.id) return;
    await deleteInventoryItem(item.id);
    message.success("Item removed");
    onClose();
  }

  async function handleAddToBuyList() {
    if (!item) return;
    await addRunningLowToBuyList(item);
    message.success(`${item.name} added to buy list`);
  }

  return (
    <Sheet
      open={open} onCancel={onClose} footer={null} title={isEdit ? "Edit item" : "Add inventory item"}
      mobileFullHeight styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onPressEnter={handleSave} autoFocus />
        <Input placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Quantity</span>
            <InputNumber size="small" min={0} value={quantity} onChange={(v) => setQuantity(v ?? 0)} />
          </div>
          <Input placeholder="Unit (e.g. rolls, bottles)" size="small" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 160 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Alert when running low</span>
          <Switch size="small" checked={trackMin} onChange={setTrackMin} />
        </div>
        {trackMin && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Minimum quantity</span>
            <InputNumber size="small" min={0} value={minQuantity} onChange={(v) => setMinQuantity(v ?? 0)} />
          </div>
        )}

        <Input.TextArea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <Button type="primary" onClick={handleSave}>{isEdit ? "Save" : "Add item"}</Button>

        {isEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<TbShoppingCart />} style={{ flex: 1 }} onClick={handleAddToBuyList}>Add to buy list</Button>
            <Popconfirm title="Remove this item?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={handleDelete}>
              <Button danger icon={<TbTrash />} style={{ flex: 1 }}>Remove</Button>
            </Popconfirm>
          </div>
        )}
      </div>
    </Sheet>
  );
}
