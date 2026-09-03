import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { InventoryItemDto } from "../db/types";
import { getDeviceId } from "./deviceId";
import { createBuyListItem } from "./shopping";

export interface NewInventoryItemInput {
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  minQuantity?: number;
  notes?: string;
}

export async function createInventoryItem(input: NewInventoryItemInput): Promise<number> {
  const now = Date.now();
  return db.inventoryItems.add({
    ownerId: getDeviceId(),
    name: input.name,
    category: input.category,
    quantity: input.quantity ?? 0,
    unit: input.unit,
    minQuantity: input.minQuantity,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateInventoryItem(id: number, patch: Partial<InventoryItemDto>): Promise<void> {
  await db.inventoryItems.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteInventoryItem(id: number): Promise<void> {
  await db.inventoryItems.delete(id);
}

export async function adjustQuantity(id: number, delta: number): Promise<void> {
  const item = await db.inventoryItems.get(id);
  if (!item) return;
  await db.inventoryItems.update(id, { quantity: Math.max(0, item.quantity + delta), updatedAt: Date.now() });
}

// Pure — unit-testable without a Dexie fixture.
export function isRunningLow(item: InventoryItemDto): boolean {
  return item.minQuantity != null && item.quantity <= item.minQuantity;
}

// The running-low -> buy-list loop: creates a BuyListItemDto tagged with
// sourceInventoryId so ShoppingView can show where it came from.
export async function addRunningLowToBuyList(item: InventoryItemDto): Promise<number> {
  return createBuyListItem({ title: item.name, urgency: "soon", sourceInventoryId: item.id });
}

export function useInventoryItems(): InventoryItemDto[] {
  return (useLiveQuery(async () => (await db.inventoryItems.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []) ?? []);
}

export function useRunningLowItems(): InventoryItemDto[] {
  const items = useInventoryItems();
  return useMemo(() => items.filter(isRunningLow), [items]);
}
