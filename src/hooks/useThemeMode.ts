import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Mode } from "../theme";

const THEME_KEY = "themeMode";
// First-paint cache only (read by index.html's inline script to kill the
// dark/light flash on reload) — Dexie remains the source of truth.
const PAINT_CACHE_KEY = "kiwami-theme";

function systemPreference(): Mode {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// No stored row yet = "respect the OS preference" (per spec); once the user
// explicitly toggles it in Settings, that choice sticks regardless of OS changes.
export function useThemeMode(): [Mode, (mode: Mode) => void] {
  const stored = useLiveQuery(() => db.settings.get(THEME_KEY));
  const mode = (stored?.value as Mode | undefined) ?? systemPreference();

  function setThemeMode(next: Mode) {
    void db.settings.put({ key: THEME_KEY, value: next });
    try {
      localStorage.setItem(PAINT_CACHE_KEY, next);
    } catch {
      /* ignore (private browsing / storage disabled) */
    }
  }

  return [mode, setThemeMode];
}
