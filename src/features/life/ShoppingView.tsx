import { useMemo, useState } from "react";
import { Button, Switch, Segmented, Empty, App } from "antd";
import { TbPlus, TbHeart, TbShoppingCart, TbShare } from "react-icons/tb";
import { useWishlistItems, useBuyListItems, formatBuyListAsText, shareOrCopyList } from "../../lib/shopping";
import { WishlistCard } from "./WishlistCard";
import { BuyListRow } from "./BuyListRow";
import { ShoppingItemEditorSheet } from "./ShoppingItemEditorSheet";
import type { WishlistItemDto, BuyListItemDto } from "../../db/types";

type ShoppingTab = "wishlist" | "buyList";

export function ShoppingView() {
  const { message } = App.useApp();
  const [tab, setTab] = useState<ShoppingTab>("wishlist");
  const [showArchivedOrBought, setShowArchivedOrBought] = useState(false);

  const wishlist = useWishlistItems();
  const buyList = useBuyListItems({ includeBought: showArchivedOrBought });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState<WishlistItemDto | null>(null);
  const [editingBuyList, setEditingBuyList] = useState<BuyListItemDto | null>(null);

  const groupedBuyList = useMemo(() => {
    const groups = new Map<string, BuyListItemDto[]>();
    for (const item of buyList) {
      const key = item.store?.trim() || "Unsorted";
      const arr = groups.get(key);
      if (arr) arr.push(item);
      else groups.set(key, [item]);
    }
    return groups;
  }, [buyList]);

  function openCreate() {
    setEditingWishlist(null);
    setEditingBuyList(null);
    setEditorOpen(true);
  }
  function openEditWishlist(item: WishlistItemDto) {
    setEditingWishlist(item);
    setEditingBuyList(null);
    setEditorOpen(true);
  }
  function openEditBuyList(item: BuyListItemDto) {
    setEditingBuyList(item);
    setEditingWishlist(null);
    setEditorOpen(true);
  }

  async function handleShare() {
    const text = formatBuyListAsText(buyList.filter((b) => !b.bought));
    const result = await shareOrCopyList(text);
    if (result === "shared") message.success("Shared");
    else if (result === "copied") message.success("Copied to clipboard");
    else message.error("Couldn't share or copy");
  }

  return (
    <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Segmented
          size="small" value={tab} onChange={(v) => setTab(v as ShoppingTab)}
          options={[
            { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbHeart size={13} /> Wishlist</span>, value: "wishlist" },
            { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbShoppingCart size={13} /> Buy list</span>, value: "buyList" },
          ]}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {tab === "buyList" && (
            <>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Show bought</span>
              <Switch size="small" checked={showArchivedOrBought} onChange={setShowArchivedOrBought} />
              <Button size="small" icon={<TbShare size={13} />} onClick={handleShare}>Share</Button>
            </>
          )}
          <Button icon={<TbPlus size={14} />} size="small" type="primary" onClick={openCreate}>
            Add
          </Button>
        </div>
      </div>

      {tab === "wishlist" ? (
        wishlist.length === 0 ? (
          <Empty image={<TbHeart size={32} style={{ opacity: 0.4, margin: "0 auto" }} />} description="Nothing on your wishlist yet" style={{ marginTop: 48 }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wishlist.map((item) => <WishlistCard key={item.id} item={item} onEdit={() => openEditWishlist(item)} />)}
          </div>
        )
      ) : buyList.length === 0 ? (
        <Empty image={<TbShoppingCart size={32} style={{ opacity: 0.4, margin: "0 auto" }} />} description="Buy list is empty" style={{ marginTop: 48 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[...groupedBuyList.entries()].map(([store, items]) => (
            <div key={store}>
              <div className="label-caps" style={{ padding: "0 2px 6px", color: "var(--ink-soft)", fontSize: 11 }}>{store}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => <BuyListRow key={item.id} item={item} onEdit={() => openEditBuyList(item)} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      <ShoppingItemEditorSheet
        open={editorOpen} onClose={() => setEditorOpen(false)} kind={tab}
        wishlistItem={editingWishlist} buyListItem={editingBuyList}
      />
    </div>
  );
}
