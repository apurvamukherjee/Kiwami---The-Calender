import { useRef } from "react";
import dayjs from "dayjs";
import { Button, Popconfirm } from "antd";
import { TbRestore, TbTrash } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { useBackClose } from "../../hooks/useBackClose";
import { unarchiveTask, deleteTaskForever } from "../../lib/tasks";
import { hapticLight } from "../../lib/haptics";
import type { TaskDto, TaskListDto } from "../../db/types";

interface Props {
  open: boolean;
  onClose: () => void;
  tasks: TaskDto[]; // archived only
  lists: TaskListDto[];
}

// Restore or permanently delete an archived task — the only place hard delete is
// reachable, guarded by its own Popconfirm (matches NoteEditorSheet's delete pattern).
export function TaskArchiveView({ open, onClose, tasks, lists }: Props) {
  useBackClose(open, onClose);
  const listName = (id: number) => lists.find((l) => l.id === id)?.name ?? "—";
  // Two distinct focus issues, both fixed here:
  // 1. With zero focusable content (the "Nothing archived yet" empty state has no
  //    interactive elements), antd's Modal focus-trap doesn't reliably move focus
  //    into the dialog on open — same class of antd Modal focus race as
  //    CommandPalette's documented afterOpenChange fix. Fixed by explicitly focusing
  //    this container once the open transition settles.
  // 2. Restoring/deleting a row removes it from the DOM — including the button that
  //    was just clicked and therefore focused. The DOM spec resets focus to <body>
  //    when the focused element is removed, silently orphaning it outside the
  //    dialog, which breaks Escape for the rest of that dialog's lifetime. Fixed by
  //    proactively refocusing this container in each row action's own click handler,
  //    before the row's removal can steal focus away.
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet
      open={open}
      onCancel={onClose}
      footer={null}
      title="Archive"
      afterOpenChange={(isOpen) => { if (isOpen) contentRef.current?.focus(); }}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div ref={contentRef} tabIndex={-1} style={{ outline: "none" }}>
      {tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-soft)", fontSize: 13 }}>Nothing archived yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                  {listName(t.listId)} · archived {t.archivedAt ? dayjs(t.archivedAt).format("D MMM") : ""}
                </div>
              </div>
              <Button
                type="text"
                size="small"
                icon={<TbRestore size={14} />}
                aria-label="Restore"
                onClick={() => { hapticLight(); contentRef.current?.focus(); void unarchiveTask(t.id!); }}
              />
              <Popconfirm
                title="Delete forever?"
                description="This can't be undone."
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => { contentRef.current?.focus(); void deleteTaskForever(t.id!); }}
              >
                <Button type="text" size="small" danger icon={<TbTrash size={14} />} aria-label="Delete forever" />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
      </div>
    </Sheet>
  );
}
