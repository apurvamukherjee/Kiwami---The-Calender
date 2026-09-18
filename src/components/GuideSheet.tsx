import { useEffect, useState, type ReactNode } from "react";
import { Button } from "antd";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  TbFlame, TbCalendarEvent, TbNotes, TbListCheck, TbLayoutDashboard, TbKeyboard,
  TbClockHour4, TbArrowsHorizontal, TbCommand, TbPill, TbChecklist, TbBox,
  TbBell, TbSparkles, TbHandClick, TbWifiOff, TbChevronLeft, TbX,
} from "react-icons/tb";
import { useBackClose } from "../hooks/useBackClose";
import { useIsMobile } from "../hooks/useIsMobile";

interface Row {
  icon: ReactNode;
  title: string;
  body: string;
}
interface Page {
  icon: ReactNode;
  title: string;
  subtitle: string;
  rows: Row[];
}

const ICON = { size: 19 } as const;

// Written against what the app actually does — including the honest limits
// (reminders are foreground-only, everything is device-local). A guide that
// promises behavior the app doesn't have is worse than no guide.
const PAGES: Page[] = [
  {
    icon: <TbFlame size={34} />,
    title: "Welcome to Kiwami",
    subtitle: "Own your days. Your calendar, routines, notes and household — all on this device.",
    rows: [
      { icon: <TbCalendarEvent {...ICON} />, title: "Calendar", body: "Today, Month, Week, Day and Agenda views of everything you've scheduled." },
      { icon: <TbNotes {...ICON} />, title: "Notes", body: "Rich notes, quick tasks and reminders — dates understood as you type." },
      { icon: <TbListCheck {...ICON} />, title: "Tasks", body: "A board for what's actually next, with a focus queue and a weekly review." },
      { icon: <TbLayoutDashboard {...ICON} />, title: "Life", body: "Medications, chores, inventory and shopping in one daily digest." },
    ],
  },
  {
    icon: <TbCalendarEvent size={34} />,
    title: "The calendar",
    subtitle: "Five ways to look at the same day. Switch with the pill in the toolbar.",
    rows: [
      { icon: <TbClockHour4 {...ICON} />, title: "Start with Today", body: "One screen with your schedule, routines, meals, due tasks and reminders." },
      { icon: <TbHandClick {...ICON} />, title: "Drag to create", body: "In Week or Day, press and hold an empty slot and drag to block out time. Drag the bottom edge to resize." },
      { icon: <TbArrowsHorizontal {...ICON} />, title: "Move fast", body: "← and → step through dates, T snaps back to today, and the date field jumps anywhere." },
      { icon: <TbSparkles {...ICON} />, title: "Multi-day events", body: "Turn on Multi-day for an all-day event and it draws as a continuous bar across Month and Week." },
    ],
  },
  {
    icon: <TbFlame size={34} />,
    title: "Routines & streaks",
    subtitle: "Mark any event as a Routine and Kiwami starts keeping the chain.",
    rows: [
      { icon: <TbFlame {...ICON} />, title: "The Ember Chain", body: "One bead per day: lit means done, ash means missed, a hollow ring means today is still open." },
      { icon: <TbHandClick {...ICON} />, title: "Tap to log", body: "Open a routine and mark it Done or Missed. Meals log as Ate or Skipped instead." },
      { icon: <TbClockHour4 {...ICON} />, title: "Missed days count", body: "A day you never answered flips to missed once it's past — that's what makes the streak mean something." },
      { icon: <TbSparkles {...ICON} />, title: "Milestones", body: "At 7, 30, 100 and 365 days the day's bead is forged into a diamond." },
    ],
  },
  {
    icon: <TbNotes size={34} />,
    title: "Notes, tasks & reminders",
    subtitle: "One composer for all three. Pick the kind, type the thing, done.",
    rows: [
      { icon: <TbSparkles {...ICON} />, title: "Type the date", body: '"gym tomorrow at 7" sets the time for you — parsed on your device, never sent anywhere.' },
      { icon: <TbNotes {...ICON} />, title: "Full-screen notes", body: "Notes open like Apple Notes: headings, colour, bold, checklists. The first line becomes the title, and it saves as you type." },
      { icon: <TbCalendarEvent {...ICON} />, title: "They land on the calendar", body: "Anything with a date shows up in Month, Week, Day and Agenda alongside your events." },
      { icon: <TbBell {...ICON} />, title: "Reminders", body: "Kiwami notifies you while it's open — there's no server, so a reminder can't wake a closed app." },
    ],
  },
  {
    icon: <TbLayoutDashboard size={34} />,
    title: "The Life tab",
    subtitle: "The parts of a day a calendar usually leaves out.",
    rows: [
      { icon: <TbPill {...ICON} />, title: "Medications", body: "Scheduled and as-needed doses, adherence streaks, and a nudge before you run out." },
      { icon: <TbChecklist {...ICON} />, title: "Chores", body: "Recurring by a fixed schedule, or rescheduled from the day you actually finished." },
      { icon: <TbBox {...ICON} />, title: "Inventory & shopping", body: "Mark something running low and send it straight to the buy list. Wishlist items promote the same way." },
      { icon: <TbClockHour4 {...ICON} />, title: "Today digest", body: "Catch-up, what's happening now, and every section for today — widen it to the week or everything." },
    ],
  },
  {
    icon: <TbKeyboard size={34} />,
    title: "You're set",
    subtitle: "A few shortcuts worth knowing, and one promise about your data.",
    rows: [
      { icon: <TbCommand {...ICON} />, title: "⌘K / Ctrl K", body: "Search every event, note, task and item — or jump straight to today, focus, or the weekly review." },
      { icon: <TbArrowsHorizontal {...ICON} />, title: "← → and T", body: "Step through periods, or snap back to today from anywhere in the calendar." },
      { icon: <TbKeyboard {...ICON} />, title: "?", body: "Reopens this guide. It's also in Settings whenever you want it." },
      { icon: <TbWifiOff {...ICON} />, title: "Offline and yours", body: "Everything lives in this browser. No account, no sync, no network calls — it keeps working with the Wi-Fi off." },
    ],
  },
];

// Apple-style onboarding: one idea per page, a big gradient glyph, four
// feature rows, dots, Continue. Mounted conditionally by its callers (never
// always-mounted with an `open` prop) — see the `ready` gate below.
export function GuideSheet({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();

  // Same StrictMode guard NoteFullEditor uses: passing a literal `true` on
  // first render makes useBackClose's dev-only doubled mount/cleanup fire a
  // history.back() whose popstate lands on the second mount's listener and
  // closes this overlay a few hundred ms after opening. Flipping `ready` in
  // an effect means the hook only ever sees `open: true` on a genuine
  // subsequent render. (See CLAUDE.md — do not "simplify" this away.)
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useBackClose(ready, onClose);

  const last = page === PAGES.length - 1;
  const p = PAGES[page];

  function go(next: number) {
    setDir(next > page ? 1 : -1);
    setPage(next);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && page < PAGES.length - 1) go(page + 1);
      else if (e.key === "ArrowLeft" && page > 0) go(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const slide = reduce ? 0 : 28;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, ease: [0.32, 0.72, 0, 1] }}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? 0 : 24,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Kiwami guide"
    >
      <motion.div
        initial={reduce ? false : { scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.6 }}
        className="glass-strong safe-top safe-bottom"
        style={{
          width: "100%", maxWidth: 520,
          height: isMobile ? "100%" : "auto", maxHeight: isMobile ? "100%" : "min(88vh, 760px)",
          borderRadius: isMobile ? 0 : 24,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 0", flexShrink: 0 }}>
          <Button
            type="text" size="small"
            icon={<TbChevronLeft size={18} />}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
            style={{ visibility: page === 0 ? "hidden" : "visible" }}
          />
          <span className="label-caps" style={{ color: "var(--ink-soft)" }}>Guide · {page + 1} of {PAGES.length}</span>
          <Button type="text" size="small" icon={<TbX size={18} />} onClick={onClose} aria-label="Close guide" />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? "8px 20px 20px" : "4px 32px 24px" }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              initial={{ opacity: 0, x: dir * slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -slide }}
              transition={{ duration: reduce ? 0 : 0.26, ease: [0.32, 0.72, 0, 1] }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 12 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20, display: "grid", placeItems: "center",
                  background: "var(--accent-gradient)", color: "#fff",
                  boxShadow: "0 10px 30px var(--ember-glow), var(--glass-rim)",
                }}>
                  {p.icon}
                </div>
                <h2 style={{ margin: "18px 0 6px", fontSize: isMobile ? 26 : 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {p.title}
                </h2>
                <p style={{ margin: 0, maxWidth: 380, fontSize: 14, lineHeight: 1.5, color: "var(--ink-soft)" }}>
                  {p.subtitle}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 28 }}>
                {p.rows.map((r) => (
                  <div key={r.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1, display: "grid", placeItems: "center", width: 22 }}>
                      {r.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{r.title}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)" }}>{r.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{
          flexShrink: 0, padding: isMobile ? "12px 20px 20px" : "12px 32px 24px",
          borderTop: "1px solid var(--glass-border)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        }}>
          <div style={{ display: "flex", gap: 7 }}>
            {PAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Page ${i + 1}`}
                aria-current={i === page ? "step" : undefined}
                style={{
                  width: i === page ? 20 : 7, height: 7, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
                  background: i === page ? "var(--accent)" : "var(--ash)",
                  transition: "width 0.3s var(--ease), background-color 0.3s var(--ease)",
                }}
              />
            ))}
          </div>
          <Button
            type="primary" size="large" block
            onClick={() => (last ? onClose() : go(page + 1))}
          >
            {last ? "Get started" : "Continue"}
          </Button>
          {!last && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              Skip
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
