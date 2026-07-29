// Best-effort tactile feedback for touch devices — silently a no-op on
// desktop browsers and anywhere Vibration API is unavailable/blocked.
export function hapticLight() {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}
export function hapticSuccess() {
  try { navigator.vibrate?.([10, 30, 10]); } catch { /* unsupported */ }
}
