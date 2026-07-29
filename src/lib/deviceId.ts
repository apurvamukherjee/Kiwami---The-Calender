const STORAGE_KEY = "kiwami-device-id";

// No auth yet, so every row is scoped to this device's random UUID instead of
// a real userId. Kept in localStorage (not Dexie) so it's stable even if
// IndexedDB is ever cleared/rebuilt independently — losing it would silently
// orphan every existing row's ownerId. Convex's schema mirrors this as a
// plain `ownerId: string` field so swapping in a real userId later is a data
// migration, not a schema rewrite.
export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
