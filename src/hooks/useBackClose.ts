import { useEffect, useRef } from "react";

// When an overlay is `open`, push a throwaway history entry so the device/
// browser Back button dismisses the overlay instead of navigating away.
// Closing the overlay via its own UI quietly pops the entry we added.
export function useBackClose(open: boolean, onClose: () => void) {
  // Callers pass an inline arrow (`onClose={() => setX(false)}`), a fresh
  // closure every render. If that were a dependency, any re-render of the
  // parent while open (e.g. a live-query update elsewhere on the page)
  // would tear the effect down and rebuild it — and the teardown's
  // `history.back()` fires a real popstate that the *newly* re-registered
  // listener then catches, closing the sheet on its own a moment later.
  // A ref sidesteps that: the effect only reacts to `open` itself.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    let poppedByUser = false;
    window.history.pushState({ kwModal: true }, "");
    const onPop = () => { poppedByUser = true; onCloseRef.current(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!poppedByUser && (window.history.state as { kwModal?: boolean } | null)?.kwModal) {
        window.history.back();
      }
    };
  }, [open]);
}
