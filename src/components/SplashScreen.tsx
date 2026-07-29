import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

// Cinematic ~3.8s intro, same pacing/structure as the sibling project's
// splash (glitch beats, breathing signature, scanline sweep) reskinned to
// Kiwami's ember identity: the ring-of-beads icon lights up sequentially,
// foreshadowing the app's signature Ember Chain streak visualization instead
// of an unrelated logo mark. Rising amber sparks replace falling ash — this
// app is about a chain staying *lit*, not decaying.
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const g1 = setTimeout(() => setGlitching(true), 900);
    const g1off = setTimeout(() => setGlitching(false), 1120);
    const g2 = setTimeout(() => setGlitching(true), 2200);
    const g2off = setTimeout(() => setGlitching(false), 2500);
    const end = setTimeout(onDone, 3800);
    return () => [g1, g1off, g2, g2off, end].forEach(clearTimeout);
  }, [onDone]);

  const sparks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        left: `${(i * 8.3) % 100}%`,
        size: 2 + (i % 3),
        duration: 5 + (i % 5),
        delay: (i * 0.35) % 4,
      })),
    [],
  );

  const beads = useMemo(() => {
    const count = 10;
    const r = 30;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      return { x: 46 + r * Math.cos(angle), y: 46 + r * Math.sin(angle) };
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="ember-vignette"
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "radial-gradient(ellipse at 50% 40%, #1a0f08 0%, #0a0a0d 55%, #050405 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "#f3f1ee", overflow: "hidden",
      }}
    >
      {sparks.map((s, i) => (
        <div key={i} className="ember-spark" style={{
          position: "absolute", top: 0, left: s.left,
          width: s.size, height: s.size, borderRadius: "50%",
          background: "rgba(255, 138, 61, 0.6)",
          animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`,
        }} />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.35, 0.2], scale: [0.5, 1.4, 1.2] }}
        transition={{ duration: 3, ease: "easeOut" }}
        style={{
          position: "absolute", width: 420, height: 420, borderRadius: "50%",
          background: "radial-gradient(circle, #ff6b3d 0%, transparent 65%)",
          filter: "blur(4px)", pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ scale: 0, rotate: -60, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.15 }}
        style={{ position: "relative", width: 92, height: 92, marginBottom: 28, zIndex: 2 }}
      >
        <svg width="92" height="92" viewBox="0 0 92 92" style={{ position: "absolute", inset: 0 }}>
          <motion.circle
            cx="46" cy="46" r="42" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: 0.3, ease: "easeInOut" }}
          />
          <motion.circle
            cx="46" cy="46" r="42" fill="none" stroke="#ff6b3d" strokeWidth="1.5"
            strokeLinecap="round" strokeDasharray="4 8"
            initial={{ rotate: 0 }} animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "46px 46px", opacity: 0.3 }}
          />
          {/* Ember Chain preview: beads light up one by one, then the core ignites. */}
          {beads.map((b, i) => (
            <motion.circle
              key={i}
              cx={b.x} cy={b.y} r="3.2" fill="#ffb15c"
              initial={{ opacity: 0.12, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.35, ease: "easeOut" }}
              style={{ filter: "drop-shadow(0 0 3px rgba(255,177,92,0.9))" }}
            />
          ))}
          <motion.circle
            cx="46" cy="46" r="6" fill="#ff6b3d"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0.7, 1, 0.7], scale: [0.9, 1.15, 0.9] }}
            transition={{ delay: 1.3, duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ filter: "drop-shadow(0 0 8px rgba(255,107,61,0.9))" }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: "relative", zIndex: 2 }}
      >
        <span
          className={`glitch${glitching ? " glitch-active" : ""}`}
          data-text="KIWAMI"
          style={{
            fontSize: 50, fontWeight: 900, letterSpacing: "0.1em",
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#f3f1ee",
            textShadow: glitching ? "none" : "0 2px 30px rgba(255, 107, 61, 0.3)",
          }}
        >KIWAMI</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        style={{ position: "relative", width: 200, height: 2, marginTop: 12, overflow: "hidden", zIndex: 2 }}
      >
        <div className="scan-line" style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, transparent 0%, #ff6b3d 50%, transparent 100%)",
        }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(255, 107, 61, 0.08)" }} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.5em",
          textTransform: "uppercase", marginTop: 18, opacity: 0.65,
          color: "#c9b8a3", zIndex: 2, marginLeft: "0.5em",
        }}
      >
        {"OWN YOUR DAYS".split("").map((ch, i) => (
          <motion.span key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 + i * 0.05, duration: 0.3 }}
          >{ch === " " ? " " : ch}</motion.span>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6, duration: 0.6 }}
        style={{ position: "absolute", bottom: 52, zIndex: 2 }}
      >
        <span className="signature-glow" style={{
          fontSize: 13, letterSpacing: "0.35em", color: "#ff6b3d", fontWeight: 700,
        }}>
          BY APURVA
        </span>
      </motion.div>

      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3, opacity: 0.04,
        background: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, #000 3px, transparent 3px)",
      }} />
    </motion.div>
  );
}
