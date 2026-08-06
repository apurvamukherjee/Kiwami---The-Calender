import { useRef } from "react";
import dayjs from "dayjs";
import { TbFlame, TbBan, TbClock } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { useWeeklyStats } from "../../lib/taskStats";
import { todayKey } from "../../lib/date.utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Read-only, retrospective — deliberately NOT a streak or gamified score (no
// "current streak" number here, matching the project's standing rule
// against a second Ember Chain for tasks). Reuses Stage 2's hearth-pill
// visual language (gradient + glow) for the header, and a hand-built CSS bar
// chart rather than a charting dependency — same precedent EmberYearGrid.tsx
// already set for the app's other data-viz surface.
export function WeeklyReviewSheet({ open, onClose }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const today = todayKey();
  const weekStart = dayjs(today).subtract(6, "day").format("YYYY-MM-DD");
  const stats = useWeeklyStats(weekStart, today);
  const maxCount = Math.max(1, ...stats.perDay.map((d) => d.count));
  // Same content-only-sheet focus fix as FocusSheet.tsx/TaskListManager.tsx.
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet
      open={open}
      onCancel={onClose}
      footer={null}
      title="Weekly review"
      afterOpenChange={(isOpen) => { if (isOpen) contentRef.current?.focus(); }}
      styles={{
        content: { background: `${tokens.surfaceLowest}e6`, backdropFilter: "blur(20px)" },
        header: { background: "transparent" },
      }}
    >
      <div ref={contentRef} tabIndex={-1} style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "8px 0 4px", outline: "none" }}>
        <div style={{
          position: "absolute", top: -80, left: -80, width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${tokens.accent}22, transparent 70%)`,
          filter: "blur(40px)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 999,
              background: `linear-gradient(135deg, ${tokens.emberHot}22, ${tokens.accent}22)`,
              boxShadow: `0 0 12px ${tokens.accent}55`,
              color: "var(--accent)", fontSize: 13, fontWeight: 800,
            }}
          >
            <TbFlame size={15} /> {stats.completedCount} tasks completed this week
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90, width: "100%", padding: "0 8px" }}>
            {stats.perDay.map((d) => (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 28,
                    height: Math.max(4, (d.count / maxCount) * 72),
                    borderRadius: 4,
                    background: d.count > 0 ? `linear-gradient(180deg, ${tokens.emberHot}, ${tokens.accent})` : tokens.ash,
                    opacity: d.count > 0 ? 1 : 0.4,
                  }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: d.date === today ? "var(--accent)" : "var(--ink-soft)", fontWeight: d.date === today ? 800 : 600 }}>
                  {dayjs(d.date).format("dd")}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)" }}>
                <TbBan size={14} /> Marked won't do
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{stats.wontDoCount}</span>
            </div>
            {stats.avgEstimateRatio != null && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)" }}>
                  <TbClock size={14} /> Estimate accuracy
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>
                  {stats.avgEstimateRatio >= 1
                    ? `~${Math.round((stats.avgEstimateRatio - 1) * 100)}% over`
                    : `~${Math.round((1 - stats.avgEstimateRatio) * 100)}% under`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
