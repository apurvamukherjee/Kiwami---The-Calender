import { useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { useTokens } from "../../hooks/useTokens";
import {
  HOUR_H, START_HOUR, TOTAL_H, HourGridLines, NowIndicator,
  TimeBlock, TimeGridColumn, layoutDayItems, eventColor,
} from "./timeGrid";
import type { CalendarItem } from "./useCalendarEvents";

const GUTTER = 56;

interface Props {
  date: string;
  items: CalendarItem[];
  onTapItem: (item: CalendarItem) => void;
  onCreateAt: (date: string, time: string, endTime: string) => void;
}

// Single wide column — more room per event than Week view affords, so this
// is where TimeBlock's non-compact detail (time range + duration) actually
// gets to breathe.
export function DayView({ date, items, onTapItem, onCreateAt }: Props) {
  const tokens = useTokens();
  const dayItems = useMemo(() => items.filter((it) => it.date === date && !it.event.allDay), [items, date]);
  const allDayItems = useMemo(() => items.filter((it) => it.date === date && it.event.allDay), [items, date]);
  const layout = useMemo(() => layoutDayItems(dayItems), [dayItems]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const h = new Date().getHours();
    scrollRef.current.scrollTop = Math.max(0, (h - START_HOUR - 1) * HOUR_H);
  }, [date]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{dayjs(date).format("dddd, D MMMM")}</div>
      </div>

      {allDayItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 20px", borderBottom: "1px solid var(--border)" }}>
          {allDayItems.map((it, i) => {
            const color = eventColor(it.event, tokens);
            return (
              <button key={i} onClick={() => onTapItem(it)} style={{
                fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: `${color}22`, color, textAlign: "left", width: "fit-content",
              }}>
                {it.event.title}
              </button>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ position: "relative", height: TOTAL_H, display: "grid", gridTemplateColumns: `${GUTTER}px 1fr` }}>
          <div style={{ position: "relative" }}>
            <HourGridLines />
          </div>
          <TimeGridColumn date={date} onCreateAt={onCreateAt} style={{ height: TOTAL_H, borderLeft: "1px solid var(--border)" }}>
            <NowIndicator date={date} left={2} right={16} />
            {dayItems.map((it, i) => {
              const pos = layout.get(it) ?? { col: 0, cols: 1 };
              return (
                <TimeBlock key={`${it.event.id}-${i}`} item={it} onTap={onTapItem}
                  insetLeft={10} insetRight={16} col={pos.col} cols={pos.cols} />
              );
            })}
          </TimeGridColumn>
        </div>
      </div>
    </div>
  );
}
