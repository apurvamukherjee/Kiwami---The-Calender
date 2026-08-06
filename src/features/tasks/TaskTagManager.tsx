import { useRef, useState } from "react";
import { Button, Input, Popconfirm, App } from "antd";
import { TbTrash, TbPlus } from "react-icons/tb";
import { Sheet } from "../../components/Sheet";
import { ColorSwatchPicker } from "../../components/ColorSwatchPicker";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { createTaskTag, updateTaskTag, deleteTaskTag } from "../../lib/tasks";
import type { TaskTagDto } from "../../db/types";

interface Props {
  open: boolean;
  onClose: () => void;
  tags: TaskTagDto[];
}

// Create/rename/recolor/delete tags — the counterpart to TaskListManager.tsx
// for tags. No reordering (tags have no `order` field), so unlike lists this
// is a plain list, not a dnd-kit sortable context.
export function TaskTagManager({ open, onClose, tags }: Props) {
  useBackClose(open, onClose);
  const tokens = useTokens();
  const { message } = App.useApp();
  const [newName, setNewName] = useState("");
  const swatches = [tokens.accent, tokens.gold, tokens.teal, tokens.danger, tokens.ash];
  // Same content-only-sheet focus fix as TaskListManager/TaskArchiveView —
  // antd's Modal focus-trap doesn't reliably move focus into a dialog with
  // no autoFocus field on open, and removing a row steals focus with it.
  const contentRef = useRef<HTMLDivElement>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    await createTaskTag({ name, color: swatches[tags.length % swatches.length] });
    setNewName("");
  }

  return (
    <Sheet
      open={open}
      onCancel={onClose}
      footer={null}
      title="Manage tags"
      afterOpenChange={(isOpen) => { if (isOpen) contentRef.current?.focus(); }}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div ref={contentRef} tabIndex={-1} style={{ outline: "none" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <Input placeholder="New tag name" value={newName} onChange={(e) => setNewName(e.target.value)} onPressEnter={handleAdd} />
          <Button icon={<TbPlus size={14} />} onClick={handleAdd} />
        </div>
        {tags.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-soft)", fontSize: 13 }}>No tags yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tags.map((t) => (
              <TagRow key={t.id} tag={t} swatches={swatches} onBeforeRowRemoved={() => contentRef.current?.focus()} onDeleted={() => message.success("Tag deleted")} />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

interface TagRowProps {
  tag: TaskTagDto;
  swatches: string[];
  onBeforeRowRemoved: () => void;
  onDeleted: () => void;
}

function TagRow({ tag, swatches, onBeforeRowRemoved, onDeleted }: TagRowProps) {
  const [name, setName] = useState(tag.name);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
      }}
    >
      <ColorSwatchPicker value={tag.color} swatches={swatches} onChange={(c) => void updateTaskTag(tag.id!, { color: c })} />
      <Input
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== tag.name) void updateTaskTag(tag.id!, { name: name.trim() }); }}
        onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
        style={{ flex: 1 }}
      />
      <Popconfirm
        title="Delete this tag?"
        description="It's removed from every task that has it."
        okText="Delete"
        okButtonProps={{ danger: true }}
        onConfirm={() => { onBeforeRowRemoved(); void deleteTaskTag(tag.id!); onDeleted(); }}
      >
        <Button type="text" size="small" danger icon={<TbTrash size={14} />} aria-label="Delete tag" />
      </Popconfirm>
    </div>
  );
}
