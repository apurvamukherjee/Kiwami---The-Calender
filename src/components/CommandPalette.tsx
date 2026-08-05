import { useEffect, useMemo, useRef, useState } from "react";
import type { InputRef } from "antd";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Modal, Input, Empty } from "antd";
import dayjs from "dayjs";
import { TbSearch, TbCalendarEvent, TbFlame, TbToolsKitchen2, TbCalendarCheck, TbFlag } from "react-icons/tb";
import { useSearchEvents } from "../features/calendar/useSearchEvents";
import { useSearchTasks } from "../features/tasks/useSearchTasks";
import { useTokens } from "../hooks/useTokens";
import { PRIORITY_TOKEN_KEY } from "../lib/tasks";

interface Props {
  open: boolean;
  onClose: () => void;
  onGoToDate: (date: string) => void;
  onGoToToday: () => void;
  onGoToTask: (taskId: number) => void;
}

// One search surface behind two entry points (Ctrl/Cmd+K and the toolbar
// search icon) instead of two different-looking search UIs — see
// useSearchEvents.ts. A floating top-anchored overlay (not the app's usual
// bottom-sheet-on-mobile Sheet) since a command palette should feel like a
// keyboard-first spotlight on every device.
export function CommandPalette({ open, onClose, onGoToDate, onGoToToday, onGoToTask }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useSearchEvents(query);
  const taskResults = useSearchTasks(query);
  const inputRef = useRef<InputRef>(null);
  const tokens = useTokens();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);
  useEffect(() => setActiveIndex(0), [query]);

  const staticActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actions: { label: string; run: () => void }[] = [];
    if (!q || "today".includes(q)) actions.push({ label: "Go to today", run: onGoToToday });
    return actions;
  }, [query, onGoToToday]);

  const total = staticActions.length + results.length + taskResults.length;

  function runIndex(i: number) {
    if (i < staticActions.length) {
      staticActions[i].run();
      onClose();
      return;
    }
    if (i < staticActions.length + results.length) {
      const r = results[i - staticActions.length];
      if (r) {
        onGoToDate(r.date);
        onClose();
      }
      return;
    }
    const tr = taskResults[i - staticActions.length - results.length];
    if (tr?.task.id != null) {
      onGoToTask(tr.task.id);
      onClose();
    }
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(total - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (total > 0) runIndex(activeIndex); }
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
          placeholder="Search events, tasks, or jump to today…"
          variant="borderless"
          prefix={<TbSearch size={16} style={{ color: "var(--ink-soft)" }} />}
          style={{ fontFamily: "var(--font-mono)" }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ maxHeight: 360, overflowY: "auto", borderTop: "1px solid var(--border)" }}>
          {total === 0 && query.trim() && (
            <div style={{ padding: "24px 0" }}>
              <Empty description="No matches" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
          {staticActions.map((a, i) => (
            <div
              key={a.label}
              onClick={() => runIndex(i)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer",
                background: activeIndex === i ? "var(--border)" : "transparent", fontSize: 13, fontWeight: 700,
              }}
            >
              <TbCalendarCheck size={14} style={{ color: "var(--accent)" }} />
              {a.label}
            </div>
          ))}
          {results.map((r, ri) => {
            const i = staticActions.length + ri;
            return (
              <div
                key={r.event.id}
                onClick={() => runIndex(i)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer",
                  background: activeIndex === i ? "var(--border)" : "transparent",
                }}
              >
                {r.event.isRoutine ? <TbFlame size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  : r.event.isFoodSlot ? <TbToolsKitchen2 size={14} style={{ color: "var(--teal)", flexShrink: 0 }} />
                  : <TbCalendarEvent size={14} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.event.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", flexShrink: 0 }}>{dayjs(r.date).format("D MMM")}</div>
              </div>
            );
          })}
          {taskResults.map((tr, tri) => {
            const i = staticActions.length + results.length + tri;
            return (
              <div
                key={tr.task.id}
                onClick={() => runIndex(i)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer",
                  background: activeIndex === i ? "var(--border)" : "transparent",
                }}
              >
                <TbFlag size={14} style={{ color: tokens[PRIORITY_TOKEN_KEY[tr.task.priority]], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tr.task.title}
                </div>
                {tr.task.dueDate && <div style={{ fontSize: 11, color: "var(--ink-soft)", flexShrink: 0 }}>{dayjs(tr.task.dueDate).format("D MMM")}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
