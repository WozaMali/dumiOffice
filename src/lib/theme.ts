const COLOR_SCHEME_KEY = "dumi-color-scheme";
const COLOR_MODE_KEY = "dumi-color-mode";

export type ColorSchemeId = "gold" | "emerald" | "rose" | "slate" | "amber" | "violet";

const VALID_SCHEMES: ColorSchemeId[] = [
  "gold",
  "emerald",
  "rose",
  "slate",
  "amber",
  "violet",
];

export type ColorModeId = "dark" | "light";
const VALID_MODES: ColorModeId[] = ["dark", "light"];

export function getStoredTheme(): ColorSchemeId {
  try {
    const v = localStorage.getItem(COLOR_SCHEME_KEY);
    if (v && VALID_SCHEMES.includes(v as ColorSchemeId)) return v as ColorSchemeId;
  } catch {
    /* ignore */
  }
  return "gold";
}

export function getStoredMode(): ColorModeId {
  try {
    const v = localStorage.getItem(COLOR_MODE_KEY);
    if (v && VALID_MODES.includes(v as ColorModeId)) return v as ColorModeId;
  } catch {
    /* ignore */
  }
  // Default to day mode so the workspace is readable immediately.
  return "light";
}

export function applyTheme(id: ColorSchemeId): void {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(COLOR_SCHEME_KEY, id);
}

export function applyMode(mode: ColorModeId): void {
  document.documentElement.setAttribute("data-mode", mode);
  localStorage.setItem(COLOR_MODE_KEY, mode);
}

export function initTheme(): void {
  applyMode(getStoredMode());
  applyTheme(getStoredTheme());
}
