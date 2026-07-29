import { theme as antdTheme, type ThemeConfig } from "antd";

const shared = {
  borderRadius: 12,
  fontFamily: "Inter, system-ui, sans-serif",
  fontSizeHeading2: 24,
  controlHeight: 40,
};
const components = {
  Card: { borderRadiusLG: 16, paddingLG: 16 },
  Button: { fontWeight: 600, borderRadius: 10, controlHeight: 42 },
  Segmented: { borderRadius: 10 },
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
        colorPrimary: "#ff9f1c",
        colorInfo: "#ff9f1c",
        colorSuccess: "#4fdbcc",
        colorWarning: "#f6b93b",
        colorError: "#ffb4ab",
        colorBgLayout: "#131313",
        colorBgContainer: "#1c1b1b",
        colorBgElevated: "#20201f",
        colorBorderSecondary: "#544434",
        colorTextHeading: "#e5e2e1",
      },
      components,
    };
  }
  return {
    ...base,
    token: {
      ...shared,
      colorPrimary: "#d9631a",
      colorInfo: "#d9631a",
      colorSuccess: "#12b3a1",
      colorWarning: "#b8860b",
      colorError: "#c8112a",
      colorBgLayout: "#f7f5f2",
      colorTextHeading: "#1c1a17",
    },
    components,
  };
}

// For style props (color/background) — these CSS vars flip with [data-theme].
export const EMBER = "var(--accent)";
export const ASH = "var(--ash)";

// Concrete hexes for contexts where CSS vars can't resolve (box-shadow glow
// intensities, canvas/SVG attrs). Keep in sync with index.css by hand.
// `diamond` ("Forge Diamond") is reserved exclusively for streak-milestone
// beads — never reused as a general accent, so a milestone reads as
// unambiguously rare against the ember palette used everywhere else.
export const TOKENS = {
  light: { accent: "#d9631a", emberHot: "#ff8a3d", ash: "#c9c2ba", gold: "#b8860b", teal: "#12b3a1", diamond: "#1f8fa8", danger: "#c8112a", surfaceLowest: "#ffffff" },
  dark: { accent: "#ff9f1c", emberHot: "#ffb86b", ash: "#353535", gold: "#f6b93b", teal: "#4fdbcc", diamond: "#90dceb", danger: "#ffb4ab", surfaceLowest: "#0e0e0e" },
};
