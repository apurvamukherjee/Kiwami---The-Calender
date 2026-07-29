import { TOKENS } from "../theme";
import { useThemeMode } from "./useThemeMode";

// Reactive concrete-hex palette for contexts where a CSS var can't be used —
// alpha-blended backgrounds built via string concat (`${hex}20`), SVG/canvas
// attributes. Style props should use the CSS vars in index.css instead.
export function useTokens() {
  const [mode] = useThemeMode();
  return TOKENS[mode];
}
