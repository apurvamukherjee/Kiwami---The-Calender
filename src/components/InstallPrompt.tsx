import { useEffect, useState } from "react";
import { Button } from "antd";
import { TbDownload, TbX } from "react-icons/tb";

const DISMISS_KEY = "kiwami-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Chrome/Edge (desktop + Android) fire `beforeinstallprompt` and expect the
// page to capture it and show its own install affordance — without this,
// the only way to install is buried in browser chrome. No-ops gracefully on
// browsers that never fire the event (Safari, Firefox).
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred || dismissed) return null;

  async function install() {
    await deferred!.prompt();
    await deferred!.userChoice;
    setDeferred(null);
  }
  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 50,
      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)", maxWidth: "calc(100vw - 32px)",
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Install Kiwami for quick, offline access</span>
      <Button size="small" type="primary" icon={<TbDownload size={14} />} onClick={install}>Install</Button>
      <Button size="small" type="text" icon={<TbX size={14} />} onClick={dismiss} aria-label="Dismiss install prompt" />
    </div>
  );
}
