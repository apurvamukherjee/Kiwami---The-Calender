import { theme as antdTheme, type ThemeConfig } from "antd";

// macOS-flavoured geometry: Apple's stock controls sit at ~10–12px radius and
// a 28–36px control height; antd's defaults are squarer and shorter.
const shared = {
  borderRadius: 12,
  borderRadiusSM: 8,
  borderRadiusLG: 16,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
  fontSizeHeading2: 24,
  controlHeight: 38,
  lineWidth: 1,
  wireframe: false,
};
const components = {
  Card: { borderRadiusLG: 18, paddingLG: 16 },
  Button: { fontWeight: 600, borderRadius: 10, controlHeight: 38, primaryShadow: "none", defaultShadow: "none" },
  Segmented: { borderRadius: 10 },
  Modal: { borderRadiusLG: 18 },
  Input: { borderRadius: 10 },
  Select: { borderRadius: 10 },
};

export type Mode = "light" | "dark";

export function getTheme(mode: Mode): ThemeConfig {
  const base: ThemeConfig = {
    // CSS-variable mode: antd writes tokens as real CSS custom properties
    // instead of baking hex values into per-theme class hashes, so dark/light
    // can actually transition instead of snapping (see index.css).
    cssVar: { key: "kiwami" },
    hashed: false,
  };
  if (mode === "dark") {
    return {
      ...base,
      algorithm: antdTheme.darkAlgorithm,
      token: {
        ...shared,
        colorPrimary: "#ff453a",
        colorInfo: "#ff453a",
        colorSuccess: "#30d158",
        colorWarning: "#ffd60a",
        colorError: "#ff375f",
        colorBgLayout: "#0b0b0e",
        colorBgContainer: "#151519",
        colorBgElevated: "#1b1b20",
        colorBorder: "rgba(255,255,255,0.14)",
        colorBorderSecondary: "rgba(255,255,255,0.08)",
        colorText: "#f2f2f7",
        colorTextSecondary: "#a1a1aa",
        colorTextHeading: "#ffffff",
      },
      components,
    };
  }
  return {
    ...base,
    token: {
      ...shared,
      colorPrimary: "#ff3b30",
      colorInfo: "#ff3b30",
      colorSuccess: "#1c9e4b",
      colorWarning: "#c79300",
      colorError: "#d70015",
      colorBgLayout: "#f5f5f7",
      colorBgContainer: "#ffffff",
      colorBorder: "rgba(0,0,0,0.14)",
      colorBorderSecondary: "rgba(0,0,0,0.08)",
      colorText: "#1d1d1f",
      colorTextHeading: "#000000",
    },
    components,
  };
}

// For style props (color/background) — these CSS vars flip with [data-theme].
export const EMBER = "var(--accent)";
export const ASH = "var(--ash)";

// Concrete hexes for contexts where CSS vars can't resolve (box-shadow glow
// intensities, canvas/SVG attrs, `${hex}20` alpha concatenation). Keep in
// sync with index.css by hand.
// `diamond` ("Forged Diamond") is reserved exclusively for streak-milestone
// beads — never reused as a general accent, so a milestone reads as
// unambiguously rare against the scarlet palette used everywhere else.
export const TOKENS = {
  light: { accent: "#ff3b30", emberHot: "#ff6b4a", ash: "#d2d2d7", gold: "#c79300", teal: "#0f83b3", diamond: "#a4133c", danger: "#d70015", surfaceLowest: "#ffffff" },
  dark: { accent: "#ff453a", emberHot: "#ff7a5e", ash: "#3a3a3f", gold: "#ffd60a", teal: "#64d2ff", diamond: "#ffd7e0", danger: "#ff375f", surfaceLowest: "#0b0b0e" },
};
