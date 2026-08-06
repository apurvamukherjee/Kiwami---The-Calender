import dayjs from "dayjs";
import { Checkbox } from "antd";
import { TbSquareCheck, TbListCheck } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import { completeTask, PRIORITY_TOKEN_KEY } from "../../lib/tasks";
import { hapticLight } from "../../lib/haptics";
import type { TaskDto } from "../../db/types";

interface Props {
  task: TaskDto;
  onTap: (task: TaskDto) => void;
  // "time" when a day header already shows the date (Agenda/Timeline day
  // groups); "full" in a flat, ungrouped feed where each row needs its own
  // date — mirrors NoteListItem's identical prop.
  dateFormat?: "time" | "full";
}

// Condensed row for a real Kanban task scheduled on a given day — shared by
// Calendar's AgendaView and the Notes page's "Task" feed/filter, now that
// both read from the same `tasks` table instead of a separate NoteDto
// kind:"task" row. A dashed left border keeps it visually distinct from
// both a real event's solid color bar and a NoteListItem row.
export function TaskAgendaRow({ task, onTap, dateFormat = "time" }: Props) {
  const tokens = useTokens();
  const color = tokens[PRIORITY_TOKEN_KEY[task.priority]];
  const scheduled = task.doDate ?? task.dueDate;
  const subtaskDone = task.subtasks.filter((s) => s.done).length;

  return (
    <div
      onClick={() => onTap(task)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer",
        borderLeft: `3px dashed ${color}`, opacity: task.completed ? 0.6 : 1,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Checkbox
        checked={!!task.completed}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { hapticLight(); void completeTask(task.id!, e.target.checked); }}
      />
      <TbSquareCheck size={15} style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, textDecoration: task.completed ? "line-through" : "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {task.title}
        </div>
        {task.subtasks.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>
            <TbListCheck size={11} /> {subtaskDone}/{task.subtasks.length} subtasks
          </div>
        )}
      </div>
      {scheduled && (
        <div style={{
          width: dateFormat === "full" ? 76 : 56, flexShrink: 0, textAlign: "right",
          fontFamily: "var(--font-mono)", fontSize: dateFormat === "full" ? 11 : 12, fontWeight: 700, color: "var(--ink-soft)",
        }}>
          {dateFormat === "full" ? dayjs(scheduled).format("D MMM") : task.allDay ? "All day" : dayjs(scheduled).format("HH:mm")}
        </div>
      )}
    </div>
  );
}
