import { useEffect, useState } from "react";
import { ConfigProvider, App as AntApp, Button } from "antd";
import { AnimatePresence } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import { getTheme } from "./theme";
import { useThemeMode } from "./hooks/useThemeMode";
import { useIsMobile } from "./hooks/useIsMobile";
import { SplashScreen } from "./components/SplashScreen";
import { InstallPrompt } from "./components/InstallPrompt";
import { CommandPalette } from "./components/CommandPalette";
import { BottomNav, type Section } from "./components/BottomNav";
import { CalendarPage, type CalendarNavRequest } from "./features/calendar/CalendarPage";
import { NotesPage } from "./features/notes/NotesPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { resolveOverdueOccurrences } from "./lib/occurrences";
import { checkDueReminders } from "./lib/notifications";
import { todayKey } from "./lib/date.utils";

const SPLASH_SEEN_KEY = "kiwami-splash-seen";
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
  const [pendingCalendarNav, setPendingCalendarNav] = useState<CalendarNavRequest | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<number | undefined>(undefined);

  useEffect(() => {
    function onPaletteKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onPaletteKey);
    return () => window.removeEventListener("keydown", onPaletteKey);
  }, []);

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
          <div style={{ flex: 1, minHeight: 0 }}>
            {section === "calendar" ? (
              <CalendarPage
                section={section}
                onChangeSection={setSection}
                onOpenPalette={() => setPaletteOpen(true)}
                pendingNav={pendingCalendarNav}
                onConsumePendingNav={() => setPendingCalendarNav(null)}
              />
            ) : section === "notes" ? (
              <NotesPage section={section} onChangeSection={setSection} />
            ) : (
              <TasksPage
                section={section}
                onChangeSection={setSection}
                pendingTaskId={pendingTaskId}
                onConsumePendingTaskId={() => setPendingTaskId(undefined)}
              />
            )}
          </div>
          {isMobile && <BottomNav section={section} onChange={setSection} />}
        </div>
        <InstallPrompt />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onGoToDate={goToDate}
          onGoToToday={goToToday}
          onGoToTask={goToTask}
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
