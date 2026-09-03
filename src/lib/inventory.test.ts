import { describe, it, expect } from "vitest";
import { isRunningLow } from "./inventory";
import type { InventoryItemDto } from "../db/types";

function item(patch: Partial<InventoryItemDto>): InventoryItemDto {
  return { ownerId: "d", name: "Paper towels", quantity: 3, createdAt: 0, updatedAt: 0, ...patch };
}

describe("isRunningLow", () => {
  it("is false when minQuantity is unset", () => {
    expect(isRunningLow(item({ quantity: 0, minQuantity: undefined }))).toBe(false);
  });

  it("is false when quantity is above minQuantity", () => {
    expect(isRunningLow(item({ quantity: 5, minQuantity: 2 }))).toBe(false);
  });

  it("is true when quantity equals minQuantity", () => {
    expect(isRunningLow(item({ quantity: 2, minQuantity: 2 }))).toBe(true);
  });

  it("is true when quantity is below minQuantity", () => {
    expect(isRunningLow(item({ quantity: 0, minQuantity: 2 }))).toBe(true);
  });
});
