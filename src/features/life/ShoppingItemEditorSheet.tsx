import { useEffect, useState } from "react";
import { Button, Input, InputNumber, Segmented, Popconfirm, App } from "antd";
import { TbTrash, TbShoppingCartPlus } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import {
  createWishlistItem, updateWishlistItem, deleteWishlistItemForever, promoteToBuyList,
  createBuyListItem, updateBuyListItem, deleteBuyListItemForever,
} from "../../lib/shopping";
import type { WishlistItemDto, BuyListItemDto, WishlistPriority, ShoppingUrgency } from "../../db/types";

type Kind = "wishlist" | "buyList";

interface Props {
  open: boolean;
  onClose: () => void;
  kind: Kind;
  wishlistItem?: WishlistItemDto | null;
  buyListItem?: BuyListItemDto | null;
}

// Shared editor for both lists — the fields that differ (wishlist's
// priority vs. buy-list's store/urgency) are the only branch; title/price/
// product link/notes are common to both, matching the report's "promote,
// don't fork a second data shape" framing.
export function ShoppingItemEditorSheet({ open, onClose, kind, wishlistItem, buyListItem }: Props) {
  useBackClose(open, onClose);
  const { message } = App.useApp();
  const isEdit = kind === "wishlist" ? !!wishlistItem : !!buyListItem;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<WishlistPriority>("medium");
  const [store, setStore] = useState("");
  const [urgency, setUrgency] = useState<ShoppingUrgency>("soon");
  const [productUrl, setProductUrl] = useState("");
  const [manualPrice, setManualPrice] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (kind === "wishlist" && wishlistItem) {
      setTitle(wishlistItem.title);
      setCategory(wishlistItem.category ?? "");
      setPriority(wishlistItem.priority);
      setProductUrl(wishlistItem.productUrl ?? "");
      setManualPrice(wishlistItem.manualPrice);
      setNotes(wishlistItem.notes ?? "");
    } else if (kind === "buyList" && buyListItem) {
      setTitle(buyListItem.title);
      setStore(buyListItem.store ?? "");
      setUrgency(buyListItem.urgency);
      setProductUrl(buyListItem.productUrl ?? "");
      setManualPrice(buyListItem.manualPrice);
    } else {
      setTitle("");
      setCategory("");
      setPriority("medium");
      setStore("");
      setUrgency("soon");
      setProductUrl("");
      setManualPrice(undefined);
      setNotes("");
    }
  }, [open, kind, wishlistItem, buyListItem]);

  async function handleSave() {
    if (!title.trim()) return;
    if (kind === "wishlist") {
      const patch = { title: title.trim(), category: category.trim() || undefined, priority, productUrl: productUrl.trim() || undefined, manualPrice, notes: notes.trim() || undefined };
      if (isEdit && wishlistItem?.id) await updateWishlistItem(wishlistItem.id, patch);
      else await createWishlistItem(patch);
    } else {
      const patch = { title: title.trim(), store: store.trim() || undefined, urgency, productUrl: productUrl.trim() || undefined, manualPrice };
      if (isEdit && buyListItem?.id) await updateBuyListItem(buyListItem.id, patch);
      else await createBuyListItem(patch);
    }
    message.success(isEdit ? "Saved" : "Added");
    onClose();
  }

  async function handleDelete() {
    if (kind === "wishlist" && wishlistItem?.id) await deleteWishlistItemForever(wishlistItem.id);
    else if (kind === "buyList" && buyListItem?.id) await deleteBuyListItemForever(buyListItem.id);
    message.success("Removed");
    onClose();
  }

  async function handlePromote() {
    if (!wishlistItem?.id) return;
    await promoteToBuyList(wishlistItem.id);
    message.success(`${wishlistItem.title} added to buy list`);
    onClose();
  }

  return (
    <Sheet
      open={open} onCancel={onClose} footer={null}
      title={isEdit ? "Edit item" : kind === "wishlist" ? "Add to wishlist" : "Add to buy list"}
      mobileFullHeight styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onPressEnter={handleSave} autoFocus />

        {kind === "wishlist" ? (
          <>
            <Input placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Priority</div>
              <Segmented block value={priority} onChange={(v) => setPriority(v as WishlistPriority)}
                options={[{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }]} />
            </div>
          </>
        ) : (
          <>
            <Input placeholder="Store (optional)" value={store} onChange={(e) => setStore(e.target.value)} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>Urgency</div>
              <Segmented block value={urgency} onChange={(v) => setUrgency(v as ShoppingUrgency)}
                options={[{ label: "Now", value: "now" }, { label: "Soon", value: "soon" }]} />
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Input placeholder="Product link (optional)" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} style={{ flex: 1 }} />
          <InputNumber placeholder="Price" min={0} value={manualPrice} onChange={(v) => setManualPrice(v ?? undefined)} style={{ width: 100 }} />
        </div>

        {kind === "wishlist" && (
          <Input.TextArea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        )}

        <Button type="primary" onClick={handleSave}>{isEdit ? "Save" : "Add"}</Button>

        {isEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            {kind === "wishlist" && !wishlistItem?.promoted && (
              <Button icon={<TbShoppingCartPlus />} style={{ flex: 1 }} onClick={handlePromote}>Promote to buy list</Button>
            )}
            <Popconfirm title="Remove this item?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={handleDelete}>
              <Button danger icon={<TbTrash />} style={{ flex: 1 }}>Remove</Button>
            </Popconfirm>
          </div>
        )}
      </div>
    </Sheet>
  );
}
