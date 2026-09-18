import { Switch, Divider, Button } from "antd";
import { TbHelpCircle } from "react-icons/tb";
import { Sheet } from "./Sheet";
import { useBackClose } from "../hooks/useBackClose";
import { useThemeMode } from "../hooks/useThemeMode";
import { FoodSlotSettings } from "../features/food/FoodSlotSettings";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenGuide: () => void;
}

export function SettingsSheet({ open, onClose, onOpenGuide }: Props) {
  useBackClose(open, onClose);
  const [mode, setThemeMode] = useThemeMode();

  return (
    <Sheet open={open} onCancel={onClose} footer={null} title="Settings">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Dark mode</span>
        <Switch checked={mode === "dark"} onChange={(checked) => setThemeMode(checked ? "dark" : "light")} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>How to use Kiwami</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>The walkthrough, any time. Shortcut: ?</div>
        </div>
        <Button size="small" icon={<TbHelpCircle size={15} />} onClick={() => { onClose(); onOpenGuide(); }}>
          Open guide
        </Button>
      </div>
      <Divider style={{ margin: "8px 0 16px" }} />
      <FoodSlotSettings />
    </Sheet>
  );
}
