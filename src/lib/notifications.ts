import { db } from "../db/db";
import { todayKey } from "./date.utils";

// Lazy — call the first time a Reminder is actually created, not on app
// load, so a first-run user isn't greeted with a permission prompt before
// they've done anything that needs one.
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export interface DueReminder {
  id: number;
  title: string;
}

// Foreground-only: fires while Kiwami is open (called on mount + on a 60s
// interval in App.tsx), plus the due/overdue list this returns is what
// Timeline's banner reads so a reminder is never silently missed just
// because the tab happened to be closed when its time passed — same honest
// "catch up the moment a human opens the app" pattern as
// resolveOverdueOccurrences() in occurrences.ts. True background push (fires
// with the app fully closed) needs Web Push + a server; see CLAUDE.md.
export async function checkDueReminders(onFallback?: (r: DueReminder) => void): Promise<void> {
  const now = Date.now();
  const due = (await db.notes.where("kind").equals("reminder").toArray()).filter(
    (n) => n.dueDate && !n.notifiedAt && new Date(n.dueDate).getTime() <= now,
  );
  if (due.length === 0) return;

  const canNotify = typeof Notification !== "undefined" && Notification.permission === "granted";
  for (const n of due) {
    if (canNotify) {
      new Notification(n.title || "Reminder", { body: n.description, tag: `kiwami-note-${n.id}` });
    } else {
      onFallback?.({ id: n.id!, title: n.title || "Reminder" });
    }
    await db.notes.update(n.id!, { notifiedAt: now });
  }
}

// Overdue-or-due-today, unresolved reminders — the Timeline banner's data
// source, kept separate from checkDueReminders' one-shot notify-and-stamp
// sweep so reopening the app still shows a reminder even after it's fired.
export async function overdueReminders() {
  const today = todayKey();
  const all = await db.notes.where("kind").equals("reminder").toArray();
  return all.filter((n) => n.dueDate && !n.completed && n.dueDate.slice(0, 10) <= today);
}
