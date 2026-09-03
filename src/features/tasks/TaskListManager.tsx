import { useRef, useState } from "react";
import { Button, Input, Popconfirm, App } from "antd";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TbGripVertical, TbTrash, TbPlus } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { ColorSwatchPicker } from "../../components/ColorSwatchPicker";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { createTaskList, updateTaskList, archiveTaskList, reorderTaskLists } from "../../lib/tasks";
import type { TaskListDto } from "../../db/types";

interface Props {
  open: boolean;
  onClose: () => void;
  lists: TaskListDto[]; // includeArchived=false view — archiving here hides it immediately
}

// Create/rename/recolor/reorder/archive the Kanban columns. Its own small scoped
// DndContext (vertical sortable list) — separate from KanbanBoard's own DndContext,
// since dnd-kit supports multiple independent contexts on the same page.
export function TaskListManager({ open, onClose, lists }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const { message } = App.useApp();
  const [newName, setNewName] = useState("");
  // 6 swatches, up from 5 (Part C/G) — added emberHot, a visually distinct
  // lighter ember shade already in the palette, rather than inventing a new
  // color. Still never `diamond` (reserved exclusively for streak
  // milestones — see theme.ts).
  const swatches = [tokens.accent, tokens.emberHot, tokens.gold, tokens.teal, tokens.danger, tokens.ash];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  // See TaskArchiveView.tsx's identical fix — antd's Modal focus-trap doesn't
  // reliably move focus into a content-only dialog (no autoFocus field) on open,
  // which silently breaks Escape-to-close. Same fix as CommandPalette's documented
  // afterOpenChange pattern.
  const contentRef = useRef<HTMLDivElement>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    await createTaskList({ name, color: swatches[lists.length % swatches.length] });
    setNewName("");
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = lists.map((l) => l.id!);
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    void reorderTaskLists(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <Sheet
      open={open}
      onCancel={onClose}
      footer={null}
      title="Manage lists"
      afterOpenChange={(isOpen) => { if (isOpen) contentRef.current?.focus(); }}
      mobileFullHeight
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div ref={contentRef} tabIndex={-1} style={{ outline: "none" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <Input placeholder="New list name" value={newName} onChange={(e) => setNewName(e.target.value)} onPressEnter={handleAdd} />
          <Button icon={<TbPlus size={14} />} onClick={handleAdd} />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={lists.map((l) => l.id!)} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {lists.map((l) => (
                <ListRow
                  key={l.id}
                  list={l}
                  swatches={swatches}
                  onBeforeRowRemoved={() => contentRef.current?.focus()}
                  onArchived={() => message.success("List archived")}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </Sheet>
  );
}

interface ListRowProps {
  list: TaskListDto;
  swatches: string[];
  // Archiving removes this row (including whichever of its buttons was just
  // clicked/focused) from the DOM — the DOM spec resets focus to <body> when the
  // focused element is removed, which would silently orphan focus outside the sheet
  // and break Escape-to-close for the rest of its lifetime (see TaskArchiveView.tsx's
  // identical fix). Called proactively, before the row can disappear.
  onBeforeRowRemoved: () => void;
  onArchived: () => void;
}

function ListRow({ list, swatches, onBeforeRowRemoved, onArchived }: ListRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id! });
  const [name, setName] = useState(list.name);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
      }}
    >
      <span {...attributes} {...listeners} style={{ cursor: "grab", color: "var(--ink-soft)", display: "flex" }}>
        <TbGripVertical size={16} />
      </span>
      <ColorSwatchPicker value={list.color} swatches={swatches} onChange={(c) => void updateTaskList(list.id!, { color: c })} />
      <Input
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== list.name) void updateTaskList(list.id!, { name: name.trim() }); }}
        onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
        style={{ flex: 1 }}
      />
      <Popconfirm
        title="Archive this list?"
        description="Its tasks stay but the list is hidden from the board."
        okText="Archive"
        onConfirm={() => { onBeforeRowRemoved(); void archiveTaskList(list.id!); onArchived(); }}
      >
        <Button type="text" size="small" danger icon={<TbTrash size={14} />} />
      </Popconfirm>
    </div>
  );
}
