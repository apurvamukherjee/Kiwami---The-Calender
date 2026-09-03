import { useState } from "react";
import { Button, Switch, Empty } from "antd";
import { TbPlus, TbChecklist } from "react-icons/tb";
import { useChores } from "../../lib/chores";
import { ChoreCard } from "./ChoreCard";
import { ChoreEditorSheet } from "./ChoreEditorSheet";
import type { ChoreDto } from "../../db/types";

export function ChoresView() {
  const [hideCompleted, setHideCompleted] = useState(true);
  const chores = useChores();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ChoreDto | null>(null);

  const visible = hideCompleted ? chores.filter((c) => !c.completed) : chores;

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(c: ChoreDto) {
    setEditing(c);
    setEditorOpen(true);
  }

  return (
    <div style={{ padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Button icon={<TbPlus size={14} />} size="small" type="primary" onClick={openCreate}>Add chore</Button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Show completed</span>
          <Switch size="small" checked={!hideCompleted} onChange={(v) => setHideCompleted(!v)} />
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty
          image={<TbChecklist size={32} style={{ opacity: 0.4, margin: "0 auto" }} />}
          description={chores.length === 0 ? "No chores yet" : "All caught up"}
          style={{ marginTop: 48 }}
        />
      ) : (
        visible.map((c) => <ChoreCard key={c.id} chore={c} onEdit={() => openEdit(c)} />)
      )}

      <ChoreEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} chore={editing} />
    </div>
  );
}
