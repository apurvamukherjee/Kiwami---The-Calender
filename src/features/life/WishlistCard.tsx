import { TbExternalLink } from "react-icons/tb";
import { useTokens } from "../../hooks/useTokens";
import type { WishlistItemDto, WishlistPriority } from "../../db/types";

const PRIORITY_TOKEN: Record<WishlistPriority, "ash" | "accent" | "gold"> = { low: "ash", medium: "accent", high: "gold" };

interface Props {
  item: WishlistItemDto;
  onEdit: () => void;
}

export function WishlistCard({ item, onEdit }: Props) {
  const tokens = useTokens();
  const color = tokens[PRIORITY_TOKEN[item.priority]];

  return (
    <div
      onClick={onEdit}
      style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
        padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 12,
        borderLeft: `3px solid ${color}`, cursor: "pointer", opacity: item.promoted ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, textDecoration: item.promoted ? "line-through" : "none" }}>{item.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 12, color: "var(--ink-soft)" }}>
          {item.category && <span>{item.category}</span>}
          {item.manualPrice != null && <span style={{ fontFamily: "var(--font-mono)" }}>~{item.manualPrice}</span>}
          {item.promoted && <span>Promoted</span>}
        </div>
      </div>
      {item.productUrl && (
        <a href={item.productUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--ink-soft)", marginTop: 2 }} aria-label="Open product link">
          <TbExternalLink size={15} />
        </a>
      )}
    </div>
  );
}
