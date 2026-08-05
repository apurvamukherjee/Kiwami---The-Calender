import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Button, Popconfirm } from "antd";
import {
  TbChevronLeft, TbTrash, TbBold, TbItalic, TbUnderline, TbStrikethrough,
  TbList, TbListNumbers, TbListCheck,
} from "react-icons/tb";
import { createNote, updateNote, deleteNote, htmlToTitle } from "../../lib/notes";
import { useBackClose } from "../../hooks/useBackClose";
import { useTokens } from "../../hooks/useTokens";
import { hapticLight } from "../../lib/haptics";
import type { NoteDto } from "../../db/types";

const AUTOSAVE_DEBOUNCE_MS = 600;

type BlockStyle = "title" | "heading" | "subheading" | "body";
const BLOCK_OPTIONS: { key: BlockStyle; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "heading", label: "Heading" },
  { key: "subheading", label: "Subheading" },
  { key: "body", label: "Body" },
];

function activeBlockStyle(editor: Editor): BlockStyle {
  if (editor.isActive("heading", { level: 1 })) return "title";
  if (editor.isActive("heading", { level: 2 })) return "heading";
  if (editor.isActive("heading", { level: 3 })) return "subheading";
  return "body";
}

interface Props {
  note: NoteDto | null; // null -> a brand-new note
  onClose: () => void;
}

// Full-screen, Apple-Notes-style rich text surface for the "note" kind —
// no title input (the body's first line *is* the title, exactly like Apple
// Notes), a formatting toolbar (block style, bold/italic/underline/strike,
// color, lists incl. a checklist), and continuous autosave so there's never
// a "did I save that" moment while writing. Callers mount this conditionally
// (not an always-mounted open-prop component like Sheet) so a fresh note
// always starts from a clean editor instance.
export function NoteFullEditor({ note, onClose }: Props) {
  // useBackClose must not receive `open: true` on this component's very
  // first render — React StrictMode double-invokes a component's effects
  // once on initial mount (mount -> cleanup -> mount again) to catch missing
  // cleanup, and useBackClose's cleanup calls history.back() whenever its
  // own pushState is still on top. That fake mount+cleanup pair fires a real
  // (delayed) popstate that the second mount's own listener then catches,
  // self-closing the editor moments after opening. Sheet.tsx-based
  // components never hit this because they're always-mounted with `open`
  // starting false, so the doubled initial-mount effect early-returns —
  // `open` only flips true on a later, real (non-doubled) update. Mirroring
  // that here (start false, flip true one render later) sidesteps the bug
  // without touching the shared hook.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useBackClose(ready, onClose);
  const tokens = useTokens();
  const isNew = note == null;
  const noteIdRef = useRef<number | undefined>(note?.id);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit,
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: note?.body ?? "",
    autofocus: "end",
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void persist(editor), AUTOSAVE_DEBOUNCE_MS);
    },
  });

  async function persist(editor: Editor) {
    if (editor.isEmpty) return; // nothing worth creating a row for yet
    const html = editor.getHTML();
    const title = htmlToTitle(html) || "New note";
    if (noteIdRef.current) {
      await updateNote(noteIdRef.current, { title, body: html });
    } else {
      noteIdRef.current = await createNote({ kind: "note", title, rawText: title, body: html });
    }
  }

  async function handleClose() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (editor) await persist(editor);
    // A brand-new note left empty never gets a row in the first place
    // (persist() no-ops on empty), so there's nothing to clean up here —
    // unlike clearing out a *previously saved* note, which is left alone
    // rather than silently deleted.
    onClose();
  }

  async function handleDelete() {
    if (noteIdRef.current) await deleteNote(noteIdRef.current);
    hapticLight();
    onClose();
  }

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  if (!editor) return null;

  const colors = [
    { label: "Default", value: null },
    { label: "Ember", value: tokens.accent },
    { label: "Gold", value: tokens.gold },
    { label: "Teal", value: tokens.teal },
    { label: "Danger", value: tokens.danger },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column",
      background: "var(--bg)",
    }}>
      <div className="safe-top" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        padding: "10px 12px", borderBottom: "1px solid var(--border)",
        background: "var(--toolbar-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        flexShrink: 0,
      }}>
        <Button type="text" icon={<TbChevronLeft size={18} />} onClick={() => void handleClose()}>Notes</Button>
        {!isNew && (
          <Popconfirm title="Delete this note?" description="This can't be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={handleDelete}>
            <Button type="text" icon={<TbTrash size={17} />} aria-label="Delete note" />
          </Popconfirm>
        )}
      </div>

      {/* Formatting toolbar — Apple Notes' format menu, flattened into a
          single scrollable row instead of a popover sheet, since desktop and
          mobile both benefit from one-tap access here. */}
      <div className="hide-scrollbar" style={{
        display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", overflowX: "auto",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <select
          value={activeBlockStyle(editor)}
          onChange={(e) => {
            const v = e.target.value as BlockStyle;
            const chain = editor.chain().focus();
            if (v === "title") chain.setHeading({ level: 1 }).run();
            else if (v === "heading") chain.setHeading({ level: 2 }).run();
            else if (v === "subheading") chain.setHeading({ level: 3 }).run();
            else chain.setParagraph().run();
          }}
          style={{
            padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--ink)", fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
        >
          {BLOCK_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <ToolbarDivider />
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={<TbBold size={16} />} label="Bold" />
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<TbItalic size={16} />} label="Italic" />
        <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<TbUnderline size={16} />} label="Underline" />
        <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} icon={<TbStrikethrough size={16} />} label="Strikethrough" />

        <ToolbarDivider />
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<TbList size={16} />} label="Bullet list" />
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<TbListNumbers size={16} />} label="Numbered list" />
        <ToolbarButton active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} icon={<TbListCheck size={16} />} label="Checklist" />

        <ToolbarDivider />
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setColorPickerOpen((v) => !v)}
            aria-label="Text color"
            style={{
              width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer",
              background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.teal})` }} />
          </button>
          {colorPickerOpen && (
            <div style={{
              position: "absolute", top: 34, left: 0, zIndex: 5, display: "flex", gap: 6, padding: 8,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}>
              {colors.map((c) => (
                <button
                  key={c.label}
                  aria-label={c.label}
                  onClick={() => {
                    if (c.value) editor.chain().focus().setColor(c.value).run();
                    else editor.chain().focus().unsetColor().run();
                    setColorPickerOpen(false);
                  }}
                  style={{
                    width: 22, height: 22, borderRadius: "50%", cursor: "pointer",
                    background: c.value ?? "var(--ink)", border: "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="kiwami-editor-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarDivider() {
  return <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0, margin: "0 2px" }} />;
}

function ToolbarButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      style={{
        width: 28, height: 28, borderRadius: 8, border: "1px solid transparent", cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--ink)",
      }}
    >
      {icon}
    </button>
  );
}
