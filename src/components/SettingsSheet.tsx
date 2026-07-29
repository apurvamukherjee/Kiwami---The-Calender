import { Switch, Divider } from "antd";
import { Sheet } from "./Sheet";
import { useBackClose } from "../hooks/useBackClose";
import { useThemeMode } from "../hooks/useThemeMode";
import { FoodSlotSettings } from "../features/food/FoodSlotSettings";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackClose(open, onClose);
  const [mode, setThemeMode] = useThemeMode();

  return (
    <Sheet open={open} onCancel={onClose} footer={null} title="Settings">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Dark mode</span>
        <Switch checked={mode === "dark"} onChange={(checked) => setThemeMode(checked ? "dark" : "light")} />
      </div>
      <Divider style={{ margin: "8px 0 16px" }} />
      <FoodSlotSettings />
    </Sheet>
  );
}
