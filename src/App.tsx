import { useEffect, useState, lazy, Suspense } from "react";
import { ConfigProvider, App as AntApp, Button } from "antd";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import { getTheme } from "./theme";
import { useThemeMode } from "./hooks/useThemeMode";
import { useIsMobile } from "./hooks/useIsMobile";
import { SplashScreen } from "./components/SplashScreen";
import { InstallPrompt } from "./components/InstallPrompt";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsSheet } from "./components/SettingsSheet";
import type { ChromeHandlers } from "./components/ChromeActions";
import { BottomNav, type Section } from "./components/BottomNav";
import type { CalendarNavRequest } from "./features/calendar/CalendarPage";
import type { LifeView } from "./features/life/LifePage";
import { resolveOverdueOccurrences } from "./lib/occurrences";
import { resolveOverdueMedicationDoses } from "./lib/medications";
import { checkDueReminders } from "./lib/notifications";
import { todayKey } from "./lib/date.utils";

// Exactly one section renders at a time (the ternary below) — lazy-loading
// each one keeps Calendar/Notes/Tiptap/Tasks/dnd-kit out of the very first
// chunk a user downloads, since they only ever need whichever section they
// open first. Named exports, so each dynamic import is resolved to a
// default-exported shape lazy() requires.
// The guide is a first-run overlay — never in the first chunk a returning
// user downloads, since they only ever see it again on request.
const GuideSheet = lazy(() => import("./components/GuideSheet").then((m) => ({ default: m.GuideSheet })));
const CalendarPage = lazy(() => import("./features/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const NotesPage = lazy(() => import("./features/notes/NotesPage").then((m) => ({ default: m.NotesPage })));
const TasksPage = lazy(() => import("./features/tasks/TasksPage").then((m) => ({ default: m.TasksPage })));
const LifePage = lazy(() => import("./features/life/LifePage").then((m) => ({ default: m.LifePage })));

const SPLASH_SEEN_KEY = "kiwami-splash-seen";
// localStorage, not sessionStorage: the guide is a one-time welcome, not a
// per-session beat like the splash.
const GUIDE_SEEN_KEY = "kiwami-guide-seen";
const REMINDER_SWEEP_INTERVAL_MS = 60_000;

// Runs the reminder sweep on an interval — a separate child of <AntApp>
// (not inline in App()) because the in-app notification fallback needs
// App.useApp(), which only resolves inside AntApp's own subtree.
function ReminderSweeper() {
  const { notification } = AntApp.useApp();
  useEffect(() => {
    function sweep() {
      void checkDueReminders((r) => {
        notification.info({ message: "Reminder", description: r.title, placement: "top" });
      });
    }
    void sweep();
    const interval = setInterval(sweep, REMINDER_SWEEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [notification]);
  return null;
}

export default function App() {
  // Plays once per browser session (sessionStorage, not localStorage — a
  // fresh tab/browser restart earns the cinematic intro again, but a
  // reload/navigation within the same session shouldn't replay it).
  const [ready, setReady] = useState(() => sessionStorage.getItem(SPLASH_SEEN_KEY) === "1");
  const [mode] = useThemeMode();
  const [section, setSection] = useState<Section>("calendar");
  const isMobile = useIsMobile();

  // Command Palette lives here (not inside CalendarPage) since Tasks is a sibling
  // top-level section — Ctrl/Cmd+K and the palette instance both need to work
  // regardless of which section is currently active.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [pendingCalendarNav, setPendingCalendarNav] = useState<CalendarNavRequest | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<number | undefined>(undefined);
  const [pendingNoteId, setPendingNoteId] = useState<number | undefined>(undefined);
  const [pendingTasksAction, setPendingTasksAction] = useState<"focus" | "weekly-review" | null>(null);
  const [pendingLifeView, setPendingLifeView] = useState<LifeView | undefined>(undefined);

  useEffect(() => {
    function onPaletteKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // "?" opens the guide — skipped while typing, so it never eats a
      // question mark meant for a note/task title.
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setGuideOpen(true);
      }
    }
    window.addEventListener("keydown", onPaletteKey);
    return () => window.removeEventListener("keydown", onPaletteKey);
  }, []);

  // First run only — once dismissed it's reachable from every toolbar's "?"
  // button, Settings, the Command Palette, and the "?" key.
  // Gated on `ready` so it opens *after* the splash finishes — the guide's
  // z-index is above the splash, and stacking it over a cinematic intro that
  // hasn't finished playing looks like a bug.
  useEffect(() => {
    if (!ready) return;
    try {
      if (localStorage.getItem(GUIDE_SEEN_KEY) !== "1") setGuideOpen(true);
    } catch { /* private browsing / storage disabled */ }
  }, [ready]);

  function closeGuide() {
    setGuideOpen(false);
    try { localStorage.setItem(GUIDE_SEEN_KEY, "1"); } catch { /* ignore */ }
  }

  const chrome: ChromeHandlers = {
    onOpenPalette: () => setPaletteOpen(true),
    onOpenGuide: () => setGuideOpen(true),
    onOpenSettings: () => setSettingsOpen(true),
  };

  function goToDate(date: string) {
    setSection("calendar");
    setPendingCalendarNav({ date, asDay: true, nonce: Date.now() });
  }
  function goToToday() {
    setSection("calendar");
    setPendingCalendarNav({ date: todayKey(), asDay: false, nonce: Date.now() });
  }
  function goToTask(taskId: number) {
    setSection("tasks");
    setPendingTaskId(taskId);
  }
  function goToNote(noteId: number) {
    setSection("notes");
    setPendingNoteId(noteId);
  }
  function goToFocus() {
    setSection("tasks");
    setPendingTasksAction("focus");
  }
  function goToWeeklyReview() {
    setSection("tasks");
    setPendingTasksAction("weekly-review");
  }
  function goToLife(view: LifeView) {
    setSection("life");
    setPendingLifeView(view);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  // Enable the CSS theme-transition only after first paint, so the initial
  // load never fades in from nothing (see index.css's .theme-ready rule).
  useEffect(() => {
    const t = requestAnimationFrame(() => document.documentElement.classList.add("theme-ready"));
    return () => cancelAnimationFrame(t);
  }, []);

  // Sweep any routine/food-slot occurrence left "pending" past its date —
  // must run before the calendar/streak UI reads occurrenceStatus.
  useEffect(() => {
    void resolveOverdueOccurrences();
    void resolveOverdueMedicationDoses();
  }, []);

  // registerType:"autoUpdate" would otherwise swap the service worker
  // silently in the background — surfaced here instead as a real banner so
  // a long-open tab doesn't sit on stale JS with no way to know.
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <ConfigProvider theme={getTheme(mode)}>
      <AntApp>
        <AnimatePresence>
          {!ready && (
            <SplashScreen key="splash" onDone={() => {
              sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
              setReady(true);
            }} />
          )}
        </AnimatePresence>
        <ReminderSweeper />
        <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100%" }}>
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateRows: "1fr", gridTemplateColumns: "1fr" }}>
            <Suspense fallback={null}>
              {/* Keyed on `section` so the incoming section fades up instead of
                  snapping. Deliberately NOT wrapped in AnimatePresence: each
                  section is a lazy chunk, and a suspending child detaches from
                  AnimatePresence mid-exit — the outgoing section then never
                  finishes its exit and stays mounted, stacking every visited
                  section on top of each other (a real bug, caught in the
                  browser). Enter-only is the whole effect anyway. */}
              <motion.div
                  key={section}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.32, 0.72, 0, 1] }}
                  style={{ gridArea: "1 / 1", height: "100%", minHeight: 0 }}
                >
                  {section === "calendar" ? (
                    <CalendarPage
                      section={section}
                      onChangeSection={setSection}
                      chrome={chrome}
                      pendingNav={pendingCalendarNav}
                      onConsumePendingNav={() => setPendingCalendarNav(null)}
                    />
                  ) : section === "notes" ? (
                    <NotesPage
                      section={section}
                      onChangeSection={setSection}
                      chrome={chrome}
                      pendingNoteId={pendingNoteId}
                      onConsumePendingNoteId={() => setPendingNoteId(undefined)}
                    />
                  ) : section === "tasks" ? (
                    <TasksPage
                      section={section}
                      onChangeSection={setSection}
                      chrome={chrome}
                      pendingTaskId={pendingTaskId}
                      onConsumePendingTaskId={() => setPendingTaskId(undefined)}
                      pendingTasksAction={pendingTasksAction}
                      onConsumePendingTasksAction={() => setPendingTasksAction(null)}
                    />
                  ) : (
                    <LifePage
                      section={section}
                      onChangeSection={setSection}
                      chrome={chrome}
                      onGoToDate={goToDate}
                      onGoToTask={goToTask}
                      pendingView={pendingLifeView}
                      onConsumePendingView={() => setPendingLifeView(undefined)}
                    />
                  )}
                </motion.div>
            </Suspense>
          </div>
          {isMobile && <BottomNav section={section} onChange={setSection} />}
        </div>
        <InstallPrompt />
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenGuide={() => setGuideOpen(true)} />
        {/* Suspense OUTSIDE AnimatePresence: AnimatePresence tracks its own
            direct children to run exit animations, and a Suspense boundary
            in between would hide the motion element from it. */}
        <Suspense fallback={null}>
          <AnimatePresence>
            {guideOpen && <GuideSheet key="guide" onClose={closeGuide} />}
          </AnimatePresence>
        </Suspense>
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onOpenGuide={() => setGuideOpen(true)}
          onGoToDate={goToDate}
          onGoToToday={goToToday}
          onGoToTask={goToTask}
          onGoToNote={goToNote}
          onGoToFocus={goToFocus}
          onGoToWeeklyReview={goToWeeklyReview}
          onGoToLife={goToLife}
        />
        {needRefresh && (
          <div style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 60,
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>A new version of Kiwami is ready</span>
            <Button size="small" type="primary" onClick={() => updateServiceWorker(true)}>Refresh</Button>
          </div>
        )}
      </AntApp>
    </ConfigProvider>
  );
}
