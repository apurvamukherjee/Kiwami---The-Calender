import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { WishlistItemDto, BuyListItemDto, WishlistPriority, ShoppingUrgency } from "../db/types";
import { getDeviceId } from "./deviceId";

// --- Wishlist ---

export interface NewWishlistItemInput {
  title: string;
  priority?: WishlistPriority;
  category?: string;
  notes?: string;
  productUrl?: string;
  manualPrice?: number;
}

export async function createWishlistItem(input: NewWishlistItemInput): Promise<number> {
  const now = Date.now();
  return db.wishlistItems.add({
    ownerId: getDeviceId(),
    title: input.title,
    priority: input.priority ?? "medium",
    category: input.category,
    notes: input.notes,
    productUrl: input.productUrl,
    manualPrice: input.manualPrice,
    promoted: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateWishlistItem(id: number, patch: Partial<WishlistItemDto>): Promise<void> {
  await db.wishlistItems.update(id, { ...patch, updatedAt: Date.now() });
}

export async function archiveWishlistItem(id: number): Promise<void> {
  await db.wishlistItems.update(id, { archived: true, updatedAt: Date.now() });
}

export async function deleteWishlistItemForever(id: number): Promise<void> {
  await db.wishlistItems.delete(id);
}

// One transaction: creates the buy-list row and marks the wishlist row
// promoted (dimmed in the UI), never deleted — "promote," not "move."
export async function promoteToBuyList(wishlistItemId: number, opts?: { store?: string; urgency?: ShoppingUrgency }): Promise<number> {
  return db.transaction("rw", db.wishlistItems, db.buyListItems, async () => {
    const item = await db.wishlistItems.get(wishlistItemId);
    if (!item) throw new Error("Wishlist item not found");
    const now = Date.now();
    const buyListId = await db.buyListItems.add({
      ownerId: getDeviceId(),
      title: item.title,
      store: opts?.store,
      urgency: opts?.urgency ?? "soon",
      manualPrice: item.manualPrice,
      productUrl: item.productUrl,
      bought: false,
      sourceWishlistId: item.id,
      createdAt: now,
      updatedAt: now,
    });
    await db.wishlistItems.update(wishlistItemId, { promoted: true, promotedAt: now, updatedAt: now });
    return buyListId;
  });
}

export function useWishlistItems(opts?: { includeArchived?: boolean }): WishlistItemDto[] {
  const includeArchived = opts?.includeArchived ?? false;
  return (
    useLiveQuery(async () => {
      const all = await db.wishlistItems.toArray();
      return (includeArchived ? all : all.filter((w) => !w.archived)).sort((a, b) => b.createdAt - a.createdAt);
    }, [includeArchived]) ?? []
  );
}

// --- Buy list ---

export interface NewBuyListItemInput {
  title: string;
  store?: string;
  urgency?: ShoppingUrgency;
  manualPrice?: number;
  productUrl?: string;
  sourceWishlistId?: number;
  sourceInventoryId?: number;
}

export async function createBuyListItem(input: NewBuyListItemInput): Promise<number> {
  const now = Date.now();
  return db.buyListItems.add({
    ownerId: getDeviceId(),
    title: input.title,
    store: input.store,
    urgency: input.urgency ?? "soon",
    manualPrice: input.manualPrice,
    productUrl: input.productUrl,
    bought: false,
    sourceWishlistId: input.sourceWishlistId,
    sourceInventoryId: input.sourceInventoryId,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateBuyListItem(id: number, patch: Partial<BuyListItemDto>): Promise<void> {
  await db.buyListItems.update(id, { ...patch, updatedAt: Date.now() });
}

export async function markBought(id: number, bought: boolean): Promise<void> {
  await db.buyListItems.update(id, { bought, boughtAt: bought ? Date.now() : undefined, updatedAt: Date.now() });
}

export async function deleteBuyListItemForever(id: number): Promise<void> {
  await db.buyListItems.delete(id);
}

export function useBuyListItems(opts?: { includeBought?: boolean }): BuyListItemDto[] {
  const includeBought = opts?.includeBought ?? false;
  return (
    useLiveQuery(async () => {
      const all = await db.buyListItems.toArray();
      return (includeBought ? all : all.filter((b) => !b.bought)).sort((a, b) => (a.store ?? "").localeCompare(b.store ?? ""));
    }, [includeBought]) ?? []
  );
}

// --- Share / export (no server — see LIFE_TAB_FEATURE_PLAN.md §9's browser-constraint rules) ---

// Grouped by store (InventoryDo-style organization), unstored items last.
export function formatBuyListAsText(items: BuyListItemDto[]): string {
  const byStore = new Map<string, BuyListItemDto[]>();
  for (const item of items) {
    const key = item.store?.trim() || "Unsorted";
    const arr = byStore.get(key);
    if (arr) arr.push(item);
    else byStore.set(key, [item]);
  }
  const lines: string[] = ["Kiwami Buy List"];
  for (const [store, storeItems] of byStore) {
    lines.push("", store + ":");
    for (const item of storeItems) {
      const price = item.manualPrice != null ? ` (~${item.manualPrice})` : "";
      lines.push(`- ${item.title}${price}`);
    }
  }
  return lines.join("\n");
}

// Feature-detects navigator.canShare/navigator.share first; always falls
// back to clipboard. A "Share" affordance should only ever be the primary
// action when canShare() is true — callers decide the button label off the
// same check, this function just performs whichever path is available.
export async function shareOrCopyList(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data?: ShareData) => Promise<void> };
    if (nav.canShare?.({ text }) && nav.share) {
      await nav.share({ text, title: "Kiwami Buy List" });
      return "shared";
    }
  } catch {
    // user cancelled the share sheet or it genuinely failed — fall through to clipboard
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
