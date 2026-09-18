import { Button } from "antd";
import { TbSearch, TbHelpCircle, TbSettings } from "react-icons/tb";

// The three app-wide chrome actions. Every section's toolbar renders this, so
// Search / Guide / Settings are reachable from Calendar, Notes, Tasks and Life
// alike — before this they lived only in CalendarPage's toolbar, which meant
// Settings was unreachable from three of the four sections.
export interface ChromeHandlers {
  onOpenPalette: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
}

export function ChromeActions({ onOpenPalette, onOpenGuide, onOpenSettings }: ChromeHandlers) {
  return (
    <>
      <Button type="text" size="small" icon={<TbSearch size={16} />} onClick={onOpenPalette} aria-label="Search (Ctrl+K)" />
      <Button type="text" size="small" icon={<TbHelpCircle size={16} />} onClick={onOpenGuide} aria-label="Guide (?)" />
      <Button type="text" size="small" icon={<TbSettings size={16} />} onClick={onOpenSettings} aria-label="Settings" />
    </>
  );
}
