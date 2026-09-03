import { useEffect, useState } from "react";
import { Segmented } from "antd";
import { TbSun, TbPill, TbChecklist, TbBox, TbShoppingBag } from "react-icons/tb";
import { useIsMobile } from "../../hooks/useIsMobile";
import { SectionTabs } from "../../components/SectionTabs";
import type { Section } from "../../components/BottomNav";
import { TodayDigest } from "./TodayDigest";
import { MedicationsView } from "./MedicationsView";
import { ChoresView } from "./ChoresView";
import { InventoryView } from "./InventoryView";
import { ShoppingView } from "./ShoppingView";

export type LifeView = "today" | "medications" | "chores" | "inventory" | "shopping";

interface Props {
  section: Section;
  onChangeSection: (s: Section) => void;
  onGoToDate: (date: string) => void;
  onGoToTask: (taskId: number) => void;
  // Command Palette deep-links here — jump straight to the right sub-view,
  // mirroring how CalendarPage/TasksPage already consume a pending*
  // request from App.tsx (pendingCalendarNav/pendingTaskId).
  pendingView?: LifeView;
  onConsumePendingView: () => void;
}

const VIEW_OPTIONS = [
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbSun size={13} /> Today</span>, value: "today" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbPill size={13} /> Medications</span>, value: "medications" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbChecklist size={13} /> Chores</span>, value: "chores" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbBox size={13} /> Inventory</span>, value: "inventory" },
  { label: <span style={{ display: "flex", alignItems: "center", gap: 4 }}><TbShoppingBag size={13} /> Shopping</span>, value: "shopping" },
];

// Life section shell, mirroring TasksPage.tsx's structure: sticky toolbar ->
// a second-level Segmented switching between Today/Medications/Chores/
// Inventory/Shopping -> the active sub-view filling the rest of the
// viewport. See LIFE_TAB_FEATURE_PLAN.md for the full design.
export function LifePage({ section, onChangeSection, onGoToDate, onGoToTask, pendingView, onConsumePendingView }: Props) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<LifeView>("today");

  useEffect(() => {
    if (!pendingView) return;
    setView(pendingView);
    onConsumePendingView();
  }, [pendingView, onConsumePendingView]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
          borderBottom: "1px solid var(--border)", flexWrap: "wrap", flexShrink: 0,
          background: "var(--toolbar-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          position: "relative", zIndex: 10,
        }}
        className="safe-top"
      >
        {!isMobile && <SectionTabs section={section} onChange={onChangeSection} />}
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1, minWidth: 100 }}>Life</div>
      </div>

      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <Segmented size="small" value={view} onChange={(v) => setView(v as LifeView)} options={VIEW_OPTIONS} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {view === "today" && <TodayDigest onGoToDate={onGoToDate} onGoToTask={onGoToTask} onSwitchView={setView} />}
        {view === "medications" && <MedicationsView />}
        {view === "chores" && <ChoresView />}
        {view === "inventory" && <InventoryView />}
        {view === "shopping" && <ShoppingView />}
      </div>
    </div>
  );
}
