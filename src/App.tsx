import { useEffect, useState } from "react";
import { ConfigProvider, App as AntApp, Button } from "antd";
import { AnimatePresence } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import { getTheme } from "./theme";
import { useThemeMode } from "./hooks/useThemeMode";
import { SplashScreen } from "./components/SplashScreen";
import { InstallPrompt } from "./components/InstallPrompt";
import { CalendarPage } from "./features/calendar/CalendarPage";
import { resolveOverdueOccurrences } from "./lib/occurrences";

const SPLASH_SEEN_KEY = "kiwami-splash-seen";

export default function App() {
  // Plays once per browser session (sessionStorage, not localStorage — a
  // fresh tab/browser restart earns the cinematic intro again, but a
  // reload/navigation within the same session shouldn't replay it).
  const [ready, setReady] = useState(() => sessionStorage.getItem(SPLASH_SEEN_KEY) === "1");
  const [mode] = useThemeMode();

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
        <CalendarPage />
        <InstallPrompt />
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
