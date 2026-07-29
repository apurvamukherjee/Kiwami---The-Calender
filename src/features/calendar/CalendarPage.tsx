import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Button, Segmented } from "antd";
import { TbChevronLeft, TbChevronRight, TbPlus, TbSettings } from "react-icons/tb";
import { useIsMobile } from "../../hooks/useIsMobile";
import { SettingsSheet } from "../../components/SettingsSheet";
import { useCalendarRange, type CalendarView } from "./useCalendarRange";
import { useCalendarEvents, type CalendarItem } from "./useCalendarEvents";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { AgendaView } from "./AgendaView";
import { EventEditorSheet } from "./EventEditorSheet";
import { RoutineDetailSheet } from "../routines/RoutineDetailSheet";
import { FoodLogSheet } from "../food/FoodLogSheet";
import { todayKey } from "../../lib/date.utils";

const DESKTOP_VIEWS = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
  { label: "Agenda", value: "agenda" },
];
const MOBILE_VIEWS = [
  { label: "Day", value: "day" },
  { label: "Agenda", value: "agenda" },
];

// Full-width desktop calendar shell (toolbar + active view filling the rest
// of the viewport) that collapses to Day+Agenda only below the mobile
// breakpoint — not a phone card scaled up, a real responsive app shell.
export function CalendarPage() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(todayKey());
  const { rangeStart, rangeEnd } = useCalendarRange(view, currentDate);
  const items = useCalendarEvents(rangeStart, rangeEnd);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{ date?: string; time?: string; endTime?: string }>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false);
  const [routineItem, setRoutineItem] = useState<CalendarItem | null>(null);
  const [foodSheetOpen, setFoodSheetOpen] = useState(false);
  const [foodItem, setFoodItem] = useState<CalendarItem | null>(null);

  useEffect(() => {
    if (isMobile && (view === "month" || view === "week")) setView("day");
  }, [isMobile, view]);

  const periodLabel = useMemo(() => {
    const d = dayjs(currentDate);
    if (view === "month") return d.format("MMMM YYYY");
    if (view === "week") {
      const start = dayjs(rangeStart), end = dayjs(rangeEnd);
      return start.isSame(end, "month")
        ? `${start.format("MMM D")} – ${end.format("D, YYYY")}`
        : `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;
    }
    if (view === "day") return d.format("dddd, D MMMM YYYY");
    return `${dayjs(rangeStart).format("MMM D")} – ${dayjs(rangeEnd).format("MMM D, YYYY")}`;
  }, [view, currentDate, rangeStart, rangeEnd]);

  function step(dir: 1 | -1) {
    if (view === "agenda") {
      setCurrentDate(dayjs(currentDate).add(dir * 30, "day").format("YYYY-MM-DD"));
      return;
    }
    const unit = view === "month" ? "month" : view === "week" ? "week" : "day";
    setCurrentDate(dayjs(currentDate).add(dir, unit).format("YYYY-MM-DD"));
  }

  function openCreate(date?: string, time?: string, endTime?: string) {
    setEditingItem(null);
    setCreateDefaults({ date: date ?? currentDate, time, endTime });
    setEditorOpen(true);
  }
  function openEdit(item: CalendarItem) {
    // Routines get the streak/Done-Missed action sheet first; food slots get
    // the lighter Ate/Skipped log. Both route into the full EventEditorSheet
    // via their own "Edit" button.
    if (item.event.isRoutine) {
      setRoutineItem(item);
      setRoutineSheetOpen(true);
      return;
    }
    if (item.event.isFoodSlot) {
      setFoodItem(item);
      setFoodSheetOpen(true);
      return;
    }
    setEditingItem(item);
    setEditorOpen(true);
  }
  function selectDay(date: string) {
    setCurrentDate(date);
    setView("day");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100%" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
        borderBottom: "1px solid var(--border)", flexWrap: "wrap", flexShrink: 0,
      }} className="safe-top">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Button size="small" onClick={() => setCurrentDate(todayKey())}>Today</Button>
          <Button size="small" type="text" icon={<TbChevronLeft size={16} />} onClick={() => step(-1)} />
          <Button size="small" type="text" icon={<TbChevronRight size={16} />} onClick={() => step(1)} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, flex: 1, minWidth: 140 }}>{periodLabel}</div>
        <Segmented value={view} onChange={(v) => setView(v as CalendarView)} options={isMobile ? MOBILE_VIEWS : DESKTOP_VIEWS} />
        <Button type="primary" icon={<TbPlus size={15} />} onClick={() => openCreate()}>New</Button>
        <Button type="text" icon={<TbSettings size={17} />} onClick={() => setSettingsOpen(true)} />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {view === "month" && (
          <MonthView rangeStart={rangeStart} rangeEnd={rangeEnd} currentDate={currentDate}
            items={items} onTapItem={openEdit} onSelectDay={selectDay} />
        )}
        {view === "week" && (
          <WeekView rangeStart={rangeStart} items={items} onTapItem={openEdit}
            onCreateAt={(d, t, e) => openCreate(d, t, e)} onSelectDay={selectDay} />
        )}
        {view === "day" && (
          <DayView date={currentDate} items={items} onTapItem={openEdit}
            onCreateAt={(d, t, e) => openCreate(d, t, e)} />
        )}
        {view === "agenda" && <AgendaView items={items} onTapItem={openEdit} />}
      </div>

      <EventEditorSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        item={editingItem}
        defaultDate={createDefaults.date}
        defaultTime={createDefaults.time}
        defaultEndTime={createDefaults.endTime}
      />
      <RoutineDetailSheet
        open={routineSheetOpen}
        onClose={() => setRoutineSheetOpen(false)}
        item={routineItem}
        onEdit={(it) => { setEditingItem(it); setEditorOpen(true); }}
      />
      <FoodLogSheet
        open={foodSheetOpen}
        onClose={() => setFoodSheetOpen(false)}
        item={foodItem}
        onEdit={(it) => { setEditingItem(it); setEditorOpen(true); }}
      />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
