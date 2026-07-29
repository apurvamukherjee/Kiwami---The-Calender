import { motion } from "framer-motion";
import { useTokens } from "../hooks/useTokens";
import type { OccurrenceStatusValue } from "../db/types";

// "none" = no occurrenceStatus row for that date (before the routine existed,
// or a gap) — rendered as a dim empty slot, distinct from an explicit miss.
export type EmberBeadStatus = OccurrenceStatusValue | "none";

export const STREAK_MILESTONES = [7, 30, 100, 365];

interface EmberChainProps {
  beads: EmberBeadStatus[]; // oldest -> newest; the last entry is always today
  size?: "compact" | "full";
  // The event's *actual* cached streak count (not inferred from the visible
  // bead window — a compact 7-bead Agenda chain can't know a day-30
  // milestone was reached outside it). Only pass this where the real count
  // is already at hand (RoutineDetailSheet).
  milestoneStreak?: number;
}

// The app's signature streak visual: a horizontal chain of beads, one per
// day. Done days glow like a lit ember; missed days go cold ash and the
// chain visibly breaks there; today sitting unresolved pulses softly,
// waiting to be lit. Deliberately not a progress bar or a ring — the whole
// point is that a streak reads as a physical chain that can catch fire or
// go cold, not an abstract percentage.
export function EmberChain({ beads, size = "compact", milestoneStreak }: EmberChainProps) {
  const tokens = useTokens();
  const dim = size === "compact" ? 8 : 15;
  const gap = size === "compact" ? 4 : 7;
  const glow = size === "compact" ? 4 : 9;
  const isMilestone = milestoneStreak != null && STREAK_MILESTONES.includes(milestoneStreak);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
      <div style={{
        position: "absolute", left: dim / 2, right: dim / 2, top: "50%", height: 1.5,
        background: "var(--border)", transform: "translateY(-50%)", zIndex: 0,
      }} />
      <div style={{ display: "flex", gap, position: "relative", zIndex: 1 }}>
        {beads.map((status, i) => {
          const isToday = i === beads.length - 1;
          if (status === "done" && isToday && isMilestone) {
            // Keyed on the milestone number itself, not just `i` — this is
            // what makes the burst replay exactly when a *new* milestone is
            // reached (e.g. the tap that takes the streak to 7), and not
            // every time the sheet is reopened at an already-forged streak.
            // Colored with `diamond` — the one token in the app reserved
            // exclusively for milestones, never reused as a general accent.
            return <ForgedBead key={`milestone-${milestoneStreak}`} dim={dim} glow={glow} diamond={tokens.diamond} />;
          }
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
                  background: `linear-gradient(135deg, ${tokens.emberHot}, ${tokens.accent})`,
                  boxShadow: `0 0 ${glow}px ${tokens.accent}, 0 0 ${glow / 2}px ${tokens.emberHot}`,
                }}
              />
            );
          }
          if (status === "missed") {
            // A "crater" bead: a flat ash disc with a smaller, darker inset
            // circle — cold and inert next to the lit gradient beads.
            return (
              <div key={i} style={{
                width: dim, height: dim, borderRadius: "50%",
                background: tokens.ash, opacity: 0.75,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
              }}>
                <div style={{
                  width: dim * 0.55, height: dim * 0.55, borderRadius: "50%",
                  background: "var(--bg)", opacity: 0.4,
                }} />
              </div>
            );
          }
          if (status === "pending" && isToday) {
            // The "full" size (RoutineDetailSheet's hero chain) gets a
            // filled, pinging bead — a definitive "waiting for today" cue.
            // "compact" (Agenda rows, many chains on screen at once) keeps
            // the quieter hollow ring so a dense list doesn't feel noisy.
            if (size === "full") {
              return (
                <div key={i} style={{ position: "relative", width: dim, height: dim }}>
                  <motion.div
                    animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      background: tokens.accent,
                    }}
                  />
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: tokens.accent, border: `2px solid ${tokens.emberHot}`, boxSizing: "border-box",
                    boxShadow: `0 0 ${glow * 1.4}px ${tokens.accent}`,
                  }} />
                </div>
              );
            }
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

// A milestone day (7/30/100/365) forges its bead into a faceted diamond
// instead of a plain circle, with a one-time expanding-ring burst. Historical
// milestone days (revisited later) just show the diamond, statically — the
// `key` on the parent is what limits the burst to the moment it's newly earned.
function ForgedBead({ dim, glow, diamond }: { dim: number; glow: number; diamond: string }) {
  return (
    <div style={{ position: "relative", width: dim, height: dim, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div
        initial={{ scale: 0.3, opacity: 0.9 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        style={{
          position: "absolute", width: dim, height: dim, borderRadius: 3,
          background: diamond, transform: "rotate(45deg)",
        }}
      />
      <motion.div
        initial={{ scale: 0.4, rotate: 0 }}
        animate={{ scale: 1, rotate: 45 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        style={{
          width: dim * 0.82, height: dim * 0.82, borderRadius: 3,
          background: diamond,
          boxShadow: `0 0 ${glow * 1.6}px ${diamond}, 0 0 ${glow}px ${diamond}`,
        }}
      />
    </div>
  );
}
