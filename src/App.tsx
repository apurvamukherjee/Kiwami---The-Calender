import { useEffect, useState } from "react";
import { ConfigProvider, App as AntApp } from "antd";
import { AnimatePresence } from "framer-motion";
import { getTheme } from "./theme";
import { useThemeMode } from "./hooks/useThemeMode";
import { SplashScreen } from "./components/SplashScreen";
import { CalendarPage } from "./features/calendar/CalendarPage";
import { resolveOverdueOccurrences } from "./lib/occurrences";

export default function App() {
  const [ready, setReady] = useState(false);
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

  return (
    <ConfigProvider theme={getTheme(mode)}>
      <AntApp>
        <AnimatePresence>
          {!ready && <SplashScreen key="splash" onDone={() => setReady(true)} />}
        </AnimatePresence>
        <CalendarPage />
      </AntApp>
    </ConfigProvider>
  );
}
