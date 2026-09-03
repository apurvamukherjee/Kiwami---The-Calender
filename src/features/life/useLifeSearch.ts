import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { scoreMatch } from "../../lib/searchScore";
import type { LifeView } from "./LifePage";

const MAX_RESULTS = 8;

export interface LifeSearchResult {
  key: string;
  title: string;
  view: LifeView; // which Life sub-view owns this row — the palette jumps here, it doesn't deep-link into a per-item editor (matches TodayDigest's own onSwitchView pattern)
  kind: "medication" | "chore" | "inventory" | "wishlist" | "buyList";
}

// Fuzzy title search across every Life domain, feeding the Command Palette
// alongside useSearchEvents/useSearchTasks/useSearchNotes (same feature-
// folder convention, same scoreMatch scoring). Deliberately a single flat
// result list across five tables rather than five separate hooks — Command
// Palette only needs "jump to the right sub-view," not per-domain grouping.
export function useLifeSearch(query: string): LifeSearchResult[] {
  const medications = useLiveQuery(() => db.medications.toArray(), []) ?? [];
  const chores = useLiveQuery(() => db.chores.toArray(), []) ?? [];
  const inventoryItems = useLiveQuery(() => db.inventoryItems.toArray(), []) ?? [];
  const wishlistItems = useLiveQuery(() => db.wishlistItems.toArray(), []) ?? [];
  const buyListItems = useLiveQuery(() => db.buyListItems.toArray(), []) ?? [];

  return useMemo(() => {
    if (!query.trim()) return [];
    const scored: { result: LifeSearchResult; score: number }[] = [];

    for (const m of medications) {
      if (m.id == null) continue;
      const score = scoreMatch(query, m.name);
      if (score != null) scored.push({ score, result: { key: `med-${m.id}`, title: m.name, view: "medications", kind: "medication" } });
    }
    for (const c of chores) {
      if (c.id == null || c.archived) continue;
      const score = scoreMatch(query, c.title);
      if (score != null) scored.push({ score, result: { key: `chore-${c.id}`, title: c.title, view: "chores", kind: "chore" } });
    }
    for (const i of inventoryItems) {
      if (i.id == null) continue;
      const score = scoreMatch(query, i.name);
      if (score != null) scored.push({ score, result: { key: `inv-${i.id}`, title: i.name, view: "inventory", kind: "inventory" } });
    }
    for (const w of wishlistItems) {
      if (w.id == null || w.archived) continue;
      const score = scoreMatch(query, w.title);
      if (score != null) scored.push({ score, result: { key: `wish-${w.id}`, title: w.title, view: "shopping", kind: "wishlist" } });
    }
    for (const b of buyListItems) {
      if (b.id == null) continue;
      const score = scoreMatch(query, b.title);
      if (score != null) scored.push({ score, result: { key: `buy-${b.id}`, title: b.title, view: "shopping", kind: "buyList" } });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS).map((s) => s.result);
  }, [query, medications, chores, inventoryItems, wishlistItems, buyListItems]);
}
