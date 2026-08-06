interface Props {
  value?: string;
  onChange: (color: string) => void;
  swatches: string[];
  size?: number;
}

// Shared circular-swatch-button row — extracted from TaskListManager.tsx's
// inline version (EventEditorSheet.tsx has an identical duplicate that's
// left as-is, out of scope for the Tasks work this was pulled out for).
export function ColorSwatchPicker({ value, onChange, swatches, size = 16 }: Props) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {swatches.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: c,
            cursor: "pointer",
            border: value === c ? "2px solid var(--ink)" : "2px solid transparent",
          }}
        />
      ))}
    </div>
  );
}
