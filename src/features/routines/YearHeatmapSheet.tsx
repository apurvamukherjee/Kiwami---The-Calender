import { useRef, useState } from "react";
import dayjs from "dayjs";
import { Select, Button } from "antd";
import { TbChevronLeft, TbChevronRight, TbChevronDown, TbChevronUp } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { EmberYearGrid } from "../../components/EmberYearGrid";
import { useRoutines, useYearOccurrences, useRoutineStats } from "./useRoutines";

// Derived rather than a second hardcoded array (MonthView.tsx already has
// one, abbreviated, for its grid header) — one weekday-naming source avoids
// the two drifting out of sync.
function weekdayName(day: number): string {
  return dayjs().day(day).format("dddd");
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: "1 1 100px", minWidth: 100, padding: "10px 12px", borderRadius: 10,
      border: "1px solid var(--border)", background: "var(--surface)",
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Scoped per-routine deliberately (not a blended "all routines" view) — see
// the plan/CLAUDE.md notes. A Select at the top picks which routine.
export function YearHeatmapSheet({ open, onClose }: Props) {
  useBackClose(open, onClose);
  const routines = useRoutines();
  const [routineId, setRoutineId] = useState<number | undefined>(undefined);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [statsExpanded, setStatsExpanded] = useState(false);
  // Content-only sheet, no autoFocus field — same antd Modal focus-trap fix
  // already applied to TaskListManager.tsx/TaskArchiveView.tsx/FocusSheet.tsx.
  const contentRef = useRef<HTMLDivElement>(null);
  const focusContent = (isOpen: boolean) => { if (isOpen) contentRef.current?.focus(); };

  const activeId = routineId ?? routines[0]?.id;
  const occurrences = useYearOccurrences(activeId, year);
  // Whole-life stats, decoupled from the year stepper above — current/longest
  // streak and completion rate span the routine's entire history, not just
  // the visible year. Gated on `open`: useRoutineStats' effect backfills
  // occurrences and sweeps the whole occurrenceStatus table, so it must only
  // run when this sheet is actually visible, not on every CalendarPage mount.
  const stats = useRoutineStats(open ? activeId : undefined);
  const hasWeekdayInsight = !!(stats.bestWeekday && stats.worstWeekday);

  if (routines.length === 0) {
    return (
      <Sheet open={open} onCancel={onClose} footer={null} title="Year in review" afterOpenChange={focusContent}>
        <div ref={contentRef} tabIndex={-1} style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 13, outline: "none" }}>
          Create a routine first — its year-long history shows up here.
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onCancel={onClose} footer={null} title="Year in review" width={820} afterOpenChange={focusContent}>
      <div ref={contentRef} tabIndex={-1} style={{ outline: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, marginTop: 8, flexWrap: "wrap" }}>
          <Select
            size="small"
            value={activeId}
            onChange={(v) => { setRoutineId(v); setStatsExpanded(false); }}
            options={routines.map((r) => ({ label: r.title, value: r.id }))}
            style={{ minWidth: 160 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <Button size="small" type="text" icon={<TbChevronLeft size={14} />} onClick={() => setYear((y) => y - 1)} aria-label="Previous year" />
            <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{year}</span>
            <Button size="small" type="text" icon={<TbChevronRight size={14} />} onClick={() => setYear((y) => y + 1)} aria-label="Next year" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <StatCard label="Current streak" value={`${stats.currentStreak}d`} />
          <StatCard label="Longest streak" value={`${stats.longestStreak}d`} />
          <StatCard label="Completion" value={stats.completionRate != null ? `${Math.round(stats.completionRate * 100)}%` : "—"} />
        </div>

        {hasWeekdayInsight && (
          <div style={{ marginBottom: 14 }}>
            <Button
              type="text" size="small" onClick={() => setStatsExpanded((v) => !v)}
              icon={statsExpanded ? <TbChevronUp size={14} /> : <TbChevronDown size={14} />}
            >
              Details
            </Button>
            {statsExpanded && (
              <div style={{ display: "flex", gap: 16, marginTop: 4, padding: "0 4px", fontSize: 12, color: "var(--ink-soft)" }}>
                <span>Best day: <b style={{ color: "var(--ink)" }}>{weekdayName(stats.bestWeekday!.day)}</b> ({Math.round(stats.bestWeekday!.rate * 100)}%)</span>
                <span>Worst day: <b style={{ color: "var(--ink)" }}>{weekdayName(stats.worstWeekday!.day)}</b> ({Math.round(stats.worstWeekday!.rate * 100)}%)</span>
              </div>
            )}
          </div>
        )}

        <EmberYearGrid year={year} occurrences={occurrences} />
      </div>
    </Sheet>
  );
}
