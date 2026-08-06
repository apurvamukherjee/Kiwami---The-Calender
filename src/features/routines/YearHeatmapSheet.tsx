import { useRef, useState } from "react";
import { Select, Button } from "antd";
import { TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { EmberYearGrid } from "../../components/EmberYearGrid";
import { useRoutines, useYearOccurrences } from "./useRoutines";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Scoped per-routine deliberately (not a blended "all routines" view) — see
// the plan/CLAUDE.md notes. A Select at the top picks which routine.
export function YearHeatmapSheet({ open, onClose }: Props) {
  useBackClose(open, onClose);
  const routines = useRoutines();
  const [routineId, setRoutineId] = useState<number | undefined>(undefined);
  const [year, setYear] = useState(() => new Date().getFullYear());
  // Content-only sheet, no autoFocus field — same antd Modal focus-trap fix
  // already applied to TaskListManager.tsx/TaskArchiveView.tsx/FocusSheet.tsx.
  const contentRef = useRef<HTMLDivElement>(null);
  const focusContent = (isOpen: boolean) => { if (isOpen) contentRef.current?.focus(); };

  const activeId = routineId ?? routines[0]?.id;
  const occurrences = useYearOccurrences(activeId, year);

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
    <Sheet open={open} onCancel={onClose} footer={null} title="Year in review" width={720} afterOpenChange={focusContent}>
      <div ref={contentRef} tabIndex={-1} style={{ outline: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, marginTop: 8, flexWrap: "wrap" }}>
          <Select
            size="small"
            value={activeId}
            onChange={setRoutineId}
            options={routines.map((r) => ({ label: r.title, value: r.id }))}
            style={{ minWidth: 160 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <Button size="small" type="text" icon={<TbChevronLeft size={14} />} onClick={() => setYear((y) => y - 1)} aria-label="Previous year" />
            <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{year}</span>
            <Button size="small" type="text" icon={<TbChevronRight size={14} />} onClick={() => setYear((y) => y + 1)} aria-label="Next year" />
          </div>
        </div>
        <EmberYearGrid year={year} occurrences={occurrences} />
      </div>
    </Sheet>
  );
}
