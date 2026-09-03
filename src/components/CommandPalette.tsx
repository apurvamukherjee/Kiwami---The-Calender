import { useEffect, useMemo, useRef, useState } from "react";
import type { InputRef } from "antd";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Modal, Input, Empty } from "antd";
import dayjs from "dayjs";
import {
  TbSearch, TbCalendarEvent, TbFlame, TbToolsKitchen2, TbCalendarCheck, TbFlag, TbTarget, TbChartBar, TbNote, TbBell,
  TbPill, TbChecklist, TbBox, TbHeart, TbShoppingCart, TbLayoutDashboard,
} from "react-icons/tb";
import { useSearchEvents } from "../features/calendar/useSearchEvents";
import { useSearchTasks } from "../features/tasks/useSearchTasks";
import { useSearchNotes } from "../features/notes/useSearchNotes";
import { useLifeSearch } from "../features/life/useLifeSearch";
import type { LifeView } from "../features/life/LifePage";
import { useTokens } from "../hooks/useTokens";
import { PRIORITY_TOKEN_KEY } from "../lib/tasks";

const LIFE_KIND_ICON: Record<string, ReactNode> = {
  medication: <TbPill size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />,
  chore: <TbChecklist size={14} style={{ color: "var(--teal)", flexShrink: 0 }} />,
  inventory: <TbBox size={14} style={{ color: "var(--teal)", flexShrink: 0 }} />,
  wishlist: <TbHeart size={14} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />,
  buyList: <TbShoppingCart size={14} style={{ color: "var(--gold)", flexShrink: 0 }} />,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onGoToDate: (date: string) => void;
  onGoToToday: () => void;
  onGoToTask: (taskId: number) => void;
  onGoToNote: (noteId: number) => void;
  onGoToFocus: () => void;
  onGoToWeeklyReview: () => void;
  onGoToLife: (view: LifeView) => void;
}

// One flat row per result, built by concatenating every producer (static
// actions, then events/tasks/notes) — this is the single source of truth
// for both rendering and keyboard-nav/click dispatch, so adding a new
// producer never means hand-copying index math into a second place.
interface Row {
  key: string;
  icon: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  run: () => void;
}

// One search surface behind two entry points (Ctrl/Cmd+K and the toolbar
// search icon) instead of two different-looking search UIs — see
// useSearchEvents.ts. A floating top-anchored overlay (not the app's usual
// bottom-sheet-on-mobile Sheet) since a command palette should feel like a
// keyboard-first spotlight on every device.
export function CommandPalette({ open, onClose, onGoToDate, onGoToToday, onGoToTask, onGoToNote, onGoToFocus, onGoToWeeklyReview, onGoToLife }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const eventResults = useSearchEvents(query);
  const taskResults = useSearchTasks(query);
  const noteResults = useSearchNotes(query, open);
  const lifeResults = useLifeSearch(query);
  const inputRef = useRef<InputRef>(null);
  const tokens = useTokens();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);
  useEffect(() => setActiveIndex(0), [query]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const list: Row[] = [];

    if (!q || "today".includes(q)) {
      list.push({ key: "action-today", icon: <TbCalendarCheck size={14} style={{ color: "var(--accent)" }} />, primary: "Go to today", run: onGoToToday });
    }
    if (!q || "focus".includes(q)) {
      list.push({ key: "action-focus", icon: <TbTarget size={14} style={{ color: "var(--accent)" }} />, primary: "Focus", run: onGoToFocus });
    }
    if (!q || "weekly review".includes(q) || "review".includes(q)) {
      list.push({ key: "action-review", icon: <TbChartBar size={14} style={{ color: "var(--accent)" }} />, primary: "Weekly review", run: onGoToWeeklyReview });
    }
    if (!q || "life".includes(q) || "today".includes(q)) {
      list.push({ key: "action-life", icon: <TbLayoutDashboard size={14} style={{ color: "var(--accent)" }} />, primary: "Jump to Life", run: () => onGoToLife("today") });
    }
    if (!q || "log medication dose".includes(q) || "medication".includes(q)) {
      list.push({ key: "action-med", icon: <TbPill size={14} style={{ color: "var(--accent)" }} />, primary: "Log medication dose", run: () => onGoToLife("medications") });
    }
    if (!q || "add to buy list".includes(q) || "buy list".includes(q) || "shopping".includes(q)) {
      list.push({ key: "action-buy", icon: <TbShoppingCart size={14} style={{ color: "var(--gold)" }} />, primary: "Add to buy list", run: () => onGoToLife("shopping") });
    }

    for (const r of eventResults) {
      list.push({
        key: `event-${r.event.id}`,
        icon: r.event.isRoutine ? <TbFlame size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
          : r.event.isFoodSlot ? <TbToolsKitchen2 size={14} style={{ color: "var(--teal)", flexShrink: 0 }} />
          : <TbCalendarEvent size={14} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />,
        primary: r.event.title,
        secondary: dayjs(r.date).format("D MMM"),
        run: () => onGoToDate(r.date),
      });
    }

    for (const tr of taskResults) {
      if (tr.task.id == null) continue;
      const id = tr.task.id;
      list.push({
        key: `task-${id}`,
        icon: <TbFlag size={14} style={{ color: tokens[PRIORITY_TOKEN_KEY[tr.task.priority]], flexShrink: 0 }} />,
        primary: tr.task.title,
        secondary: tr.task.dueDate ? dayjs(tr.task.dueDate).format("D MMM") : undefined,
        run: () => onGoToTask(id),
      });
    }

    for (const nr of noteResults) {
      if (nr.note.id == null) continue;
      const id = nr.note.id;
      list.push({
        key: `note-${id}`,
        icon: nr.note.kind === "reminder" ? <TbBell size={14} style={{ color: "var(--teal)", flexShrink: 0 }} /> : <TbNote size={14} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />,
        primary: nr.note.title,
        secondary: nr.note.dueDate ? dayjs(nr.note.dueDate).format("D MMM") : undefined,
        run: () => onGoToNote(id),
      });
    }

    for (const lr of lifeResults) {
      list.push({
        key: lr.key,
        icon: LIFE_KIND_ICON[lr.kind],
        primary: lr.title,
        run: () => onGoToLife(lr.view),
      });
    }

    return list;
  }, [query, eventResults, taskResults, noteResults, lifeResults, tokens, onGoToToday, onGoToFocus, onGoToWeeklyReview, onGoToDate, onGoToTask, onGoToNote, onGoToLife]);

  function runIndex(i: number) {
    const row = rows[i];
    if (!row) return;
    row.run();
    onClose();
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows.length > 0) runIndex(activeIndex); }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={480}
      style={{ top: 96 }}
      styles={{
        body: { padding: 0 },
        content: {
          background: `${tokens.surfaceLowest}e6`,
          backdropFilter: "blur(20px)",
          border: "1px solid transparent",
        },
      }}
      className="kiwami-blade"
      // antd's Modal grabs focus back onto its own wrapper right after
      // opening (for its focus-trap/accessibility handling), which raced
      // Input's `autoFocus` and won — keystrokes landed on the modal div,
      // not the input, so typing silently did nothing. Focusing explicitly
      // once the open transition finishes sidesteps the race.
      afterOpenChange={(isOpen) => { if (isOpen) inputRef.current?.focus(); }}
    >
      <div onKeyDown={onKeyDown}>
        <Input
          ref={inputRef}
          size="large"
          placeholder="Search events, notes, tasks, or jump to today…"
          variant="borderless"
          prefix={<TbSearch size={16} style={{ color: "var(--ink-soft)" }} />}
          style={{ fontFamily: "var(--font-mono)" }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ maxHeight: 360, overflowY: "auto", borderTop: "1px solid var(--border)" }}>
          {rows.length === 0 && query.trim() && (
            <div style={{ padding: "24px 0" }}>
              <Empty description="No matches" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
          {rows.map((row, i) => (
            <div
              key={row.key}
              onClick={() => runIndex(i)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer",
                background: activeIndex === i ? "var(--border)" : "transparent",
              }}
            >
              {row.icon}
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.primary}
              </div>
              {row.secondary && <div style={{ fontSize: 11, color: "var(--ink-soft)", flexShrink: 0 }}>{row.secondary}</div>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
