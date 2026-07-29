import { motion } from "framer-motion";
import { useTokens } from "../hooks/useTokens";
import type { OccurrenceStatusValue } from "../db/types";

// "none" = no occurrenceStatus row for that date (before the routine existed,
// or a gap) — rendered as a dim empty slot, distinct from an explicit miss.
export type EmberBeadStatus = OccurrenceStatusValue | "none";

interface EmberChainProps {
  beads: EmberBeadStatus[]; // oldest -> newest; the last entry is always today
  size?: "compact" | "full";
}

// The app's signature streak visual: a horizontal chain of beads, one per
// day. Done days glow like a lit ember; missed days go cold ash and the
// chain visibly breaks there; today sitting unresolved pulses softly,
// waiting to be lit. Deliberately not a progress bar or a ring — the whole
// point is that a streak reads as a physical chain that can catch fire or
// go cold, not an abstract percentage.
export function EmberChain({ beads, size = "compact" }: EmberChainProps) {
  const tokens = useTokens();
  const dim = size === "compact" ? 8 : 15;
  const gap = size === "compact" ? 4 : 7;
  const glow = size === "compact" ? 4 : 9;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
      <div style={{
        position: "absolute", left: dim / 2, right: dim / 2, top: "50%", height: 1.5,
        background: "var(--border)", transform: "translateY(-50%)", zIndex: 0,
      }} />
      <div style={{ display: "flex", gap, position: "relative", zIndex: 1 }}>
        {beads.map((status, i) => {
          const isToday = i === beads.length - 1;
          if (status === "done") {
            return (
              <motion.div
                key={i}
                layout
                initial={{ scale: 0.5, opacity: 0.3 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                style={{
                  width: dim, height: dim, borderRadius: "50%",
                  background: tokens.emberHot,
                  boxShadow: `0 0 ${glow}px ${tokens.accent}, 0 0 ${glow / 2}px ${tokens.emberHot}`,
                }}
              />
            );
          }
          if (status === "missed") {
            return (
              <div key={i} style={{
                width: dim, height: dim, borderRadius: "50%",
                background: tokens.ash, opacity: 0.75,
              }} />
            );
          }
          if (status === "pending" && isToday) {
            return (
              <motion.div
                key={i}
                animate={{ opacity: [0.35, 0.9, 0.35] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: dim, height: dim, borderRadius: "50%",
                  border: `1.5px solid ${tokens.accent}`, background: "transparent", boxSizing: "border-box",
                }}
              />
            );
          }
          return (
            <div key={i} style={{
              width: dim, height: dim, borderRadius: "50%", background: "var(--border)", opacity: 0.45,
            }} />
          );
        })}
      </div>
    </div>
  );
}
