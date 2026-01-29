import { clearFontLoadingState } from "@stores/uiStore";

export type TerminalThemeOption = {
  id: string;
  label: string;
  group: "dark" | "light";
  tone: "dark" | "light";
  description?: string;
  background: string; // base color for fallbacks
  layer?: string; // optional layered background (e.g., gradients)
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
  shadow?: string;
  selection: string;
  selectionText?: string;
  caret: string;
  chipBg?: string;
  chipHoverBg?: string;
};

export type TerminalThemeController = {
  listThemes: () => TerminalThemeOption[];
  getCurrentTheme: () => TerminalThemeOption;
  setTheme: (id: string) => Promise<TerminalThemeOption>;
  previewTheme: (id: string) => Promise<TerminalThemeOption>;
  resetPreview: () => Promise<void>;
};

const STORAGE_KEY = "terminal.theme";
const DEFAULT_THEME_ID = "midnight";

const buildLayer = (base: string, a: string, b: string) =>
  `radial-gradient(circle at 18% 18%, ${a}, transparent 38%), radial-gradient(circle at 82% 12%, ${b}, transparent 32%), ${base}`;

const THEME_OPTIONS: TerminalThemeOption[] = [
  {
    id: "midnight",
    label: "Midnight",
    group: "dark",
    tone: "dark",
    description: "Deep navy contrast",
    background: "#04060a",
    layer: buildLayer("#04060a", "rgba(141,208,255,0.08)", "rgba(120,164,255,0.06)"),
    surface: "#07080a",
    text: "#eaf1fb",
    muted: "#b9c5dc",
    accent: "#8dd0ff",
    border: "rgba(255, 255, 255, 0.12)",
    card: "rgba(255, 255, 255, 0.05)",
    shadow: "0 22px 70px rgba(0, 0, 0, 0.55)",
    selection: "rgba(141, 208, 255, 0.28)",
    caret: "#eaf1fb",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.02) 45%, rgba(0, 0, 0, 0.25))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.06) 45%, rgba(0, 0, 0, 0.35))",
  },
  {
    id: "aurora",
    label: "Aurora (gradient)",
    group: "dark",
    tone: "dark",
    description: "Teal violet gradient",
    background: "#061024",
    layer:
      "linear-gradient(145deg, #0c1a35 0%, #0b2330 25%, #0c2c2f 50%, #13203c 75%, #130f27 100%)",
    surface: "#0b1429",
    text: "#e6f4ff",
    muted: "#c6d5eb",
    accent: "#6bf2d2",
    border: "rgba(255, 255, 255, 0.14)",
    card: "rgba(255, 255, 255, 0.06)",
    shadow: "0 26px 80px rgba(4, 10, 24, 0.6)",
    selection: "rgba(107, 242, 210, 0.24)",
    caret: "#e6f4ff",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02) 48%, rgba(0, 0, 0, 0.22))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.06) 48%, rgba(0, 0, 0, 0.32))",
  },
  {
    id: "dreamland",
    label: "Dreamland",
    group: "dark",
    tone: "dark",
    description: "Candy aurora glow",
    background: "#0b0a14",
    layer:
      "radial-gradient(120% 140% at 10% 20%, rgba(255, 176, 214, 0.25), transparent 42%)," +
      "radial-gradient(110% 120% at 82% 18%, rgba(116, 199, 255, 0.28), transparent 40%)," +
      "radial-gradient(120% 120% at 48% 78%, rgba(126, 255, 199, 0.22), transparent 45%)," +
      "#0b0a14",
    surface: "#0e0d1a",
    text: "#fdfaff",
    muted: "#d2cee6",
    accent: "#ffb86c",
    border: "rgba(255, 255, 255, 0.16)",
    card: "rgba(255, 255, 255, 0.08)",
    shadow: "0 26px 80px rgba(7, 6, 18, 0.62)",
    selection: "rgba(255, 184, 108, 0.24)",
    caret: "#fdfaff",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.04) 45%, rgba(0, 0, 0, 0.28))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.08) 45%, rgba(0, 0, 0, 0.36))",
  },
  {
    id: "paper",
    label: "Paper",
    group: "light",
    tone: "light",
    description: "Calm off-white ink",
    background: "#f7f9fc",
    layer: buildLayer("#f7f9fc", "rgba(48, 108, 196, 0.12)", "rgba(23, 96, 161, 0.08)"),
    surface: "#f9fafb",
    text: "#0f172a",
    muted: "#334155",
    accent: "#245f9e",
    border: "rgba(15, 23, 42, 0.12)",
    card: "rgba(255, 255, 255, 0.92)",
    shadow: "0 18px 60px rgba(12, 22, 40, 0.18)",
    selection: "rgba(36, 95, 158, 0.18)",
    selectionText: "#0b1322",
    caret: "#0f172a",
    chipBg:
      "linear-gradient(180deg, rgba(15, 23, 42, 0.06), rgba(15, 23, 42, 0.02) 55%, rgba(15, 23, 42, 0.04))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.06) 55%, rgba(15, 23, 42, 0.08))",
  },
  {
    id: "dawn",
    label: "Dawn",
    group: "light",
    tone: "light",
    description: "Warm gray teal",
    background: "#edf1f6",
    layer: buildLayer("#edf1f6", "rgba(16, 94, 98, 0.12)", "rgba(61, 95, 180, 0.1)"),
    surface: "#f1f4f9",
    text: "#0b1320",
    muted: "#364152",
    accent: "#0f766e",
    border: "rgba(11, 19, 32, 0.14)",
    card: "rgba(255, 255, 255, 0.96)",
    shadow: "0 18px 60px rgba(11, 19, 32, 0.16)",
    selection: "rgba(15, 118, 110, 0.16)",
    selectionText: "#0b1320",
    caret: "#0b1320",
    chipBg:
      "linear-gradient(180deg, rgba(11, 19, 32, 0.05), rgba(11, 19, 32, 0.02) 55%, rgba(11, 19, 32, 0.05))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(11, 19, 32, 0.12), rgba(11, 19, 32, 0.06) 55%, rgba(11, 19, 32, 0.08))",
  },
  {
    id: "sunbeam",
    label: "Light Colorful",
    group: "light",
    tone: "light",
    description: "Airy citrus glow",
    background: "#fff8e6",
    layer: buildLayer("#fff8e6", "rgba(255, 214, 102, 0.28)", "rgba(255, 173, 120, 0.22)"),
    surface: "#fffaf0",
    text: "#2d1b00",
    muted: "#5c4630",
    accent: "#f59e0b",
    border: "rgba(45, 27, 0, 0.12)",
    card: "rgba(255, 255, 255, 0.94)",
    shadow: "0 16px 55px rgba(92, 70, 48, 0.16)",
    selection: "rgba(245, 158, 11, 0.18)",
    selectionText: "#2d1b00",
    caret: "#2d1b00",
    chipBg:
      "linear-gradient(180deg, rgba(92, 70, 48, 0.06), rgba(92, 70, 48, 0.02) 55%, rgba(92, 70, 48, 0.05))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(92, 70, 48, 0.14), rgba(92, 70, 48, 0.07) 55%, rgba(92, 70, 48, 0.1))",
  },
  {
    id: "emberglow",
    label: "Dark Colorful",
    group: "dark",
    tone: "dark",
    description: "Moody amber neon",
    background: "#0c0a08",
    layer: buildLayer("#0c0a08", "rgba(255, 170, 22, 0.16)", "rgba(255, 102, 51, 0.12)"),
    surface: "#100e0c",
    text: "#f7f0e5",
    muted: "#cdbfae",
    accent: "#c28a00",
    border: "rgba(255, 240, 229, 0.18)",
    card: "rgba(255, 255, 255, 0.07)",
    shadow: "0 22px 68px rgba(12, 10, 8, 0.7)",
    selection: "rgba(194, 138, 0, 0.28)",
    caret: "#f7f0e5",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.3))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08) 50%, rgba(0, 0, 0, 0.38))",
  },
  {
    id: "kaleidoscope",
    label: "Wildly Colorful",
    group: "dark",
    tone: "dark",
    description: "Neon rainbow storm",
    background: "#05040a",
    layer:
      "conic-gradient(from 45deg, rgba(255, 91, 146, 0.32), rgba(255, 190, 92, 0.32), rgba(124, 255, 110, 0.32), rgba(92, 212, 255, 0.32), rgba(171, 118, 255, 0.34), rgba(255, 91, 146, 0.32))," +
      "radial-gradient(120% 140% at 20% 20%, rgba(255, 91, 146, 0.24), transparent 42%)," +
      "radial-gradient(120% 140% at 82% 18%, rgba(92, 212, 255, 0.2), transparent 40%)," +
      "#05040a",
    surface: "#0a0913",
    text: "#fdfcff",
    muted: "#d9d4f0",
    accent: "#ff8b3d",
    border: "rgba(255, 255, 255, 0.18)",
    card: "rgba(255, 255, 255, 0.09)",
    shadow: "0 24px 78px rgba(0, 0, 0, 0.7)",
    selection: "rgba(255, 139, 61, 0.32)",
    caret: "#fdfcff",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.06) 50%, rgba(0, 0, 0, 0.35))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.12) 50%, rgba(0, 0, 0, 0.45))",
  },
];

let previewBase: TerminalThemeOption | null = null;
let previewing = false;

const findTheme = (id: string) =>
  THEME_OPTIONS.find((theme) => theme.id.toLowerCase() === id.toLowerCase());

const encodeCursor = (fill: string, stroke: string = "rgba(0,0,0,0.35)") => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='12' height='12' x='2' y='2' rx='2' ry='2' fill='${fill}' stroke='${stroke}' stroke-width='2'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 8 8, text`;
};

const persist = (id: string) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
};

const readPersisted = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const applyTheme = (theme: TerminalThemeOption) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.background);
  root.style.setProperty("--bg-layer", theme.layer || theme.background);
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--card", theme.card);
  if (theme.shadow) root.style.setProperty("--shadow", theme.shadow);
  root.style.setProperty("--selection", theme.selection);
  root.style.setProperty("--selection-text", theme.selectionText || theme.text);
  root.style.setProperty("--caret", theme.caret);
  root.style.setProperty("--chip-bg", theme.chipBg || "var(--card)");
  root.style.setProperty("--chip-hover-bg", theme.chipHoverBg || theme.chipBg || "var(--card)");
  root.style.setProperty("--chip-border", theme.border);
  root.style.setProperty(
    "--chip-shadow",
    theme.tone === "light"
      ? "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.08)"
      : "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)",
  );
  const suggestBg = theme.tone === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(0, 0, 0, 0.6)";
  const suggestActiveBg =
    theme.tone === "light" ? "rgba(36, 95, 158, 0.16)" : "rgba(141, 208, 255, 0.16)";
  root.style.setProperty("--suggest-bg", suggestBg);
  root.style.setProperty("--suggest-active-bg", suggestActiveBg);
  root.style.setProperty("--suggest-active-color", theme.accent);
  root.style.setProperty("--terminal-cursor", encodeCursor(theme.caret, theme.border));
  root.style.setProperty("--terminal-color-scheme", theme.tone);
  root.dataset.terminalTheme = theme.id;
  root.dataset.terminalTone = theme.tone;
};

function getInitialTheme(): TerminalThemeOption {
  const persisted = readPersisted();
  if (persisted) {
    const hit = findTheme(persisted);
    if (hit) return hit;
  }
  return findTheme(DEFAULT_THEME_ID) || THEME_OPTIONS[0];
}

export function createTerminalThemeController(): TerminalThemeController {
  let current = getInitialTheme();
  applyTheme(current);

  const setTheme = async (id: string) => {
    const theme = findTheme(id);
    if (!theme) throw new Error(`unknown theme: ${id}`);
    applyTheme(theme);
    current = theme;
    previewBase = null;
    previewing = false;
    persist(theme.id);
    clearFontLoadingState();
    return theme;
  };

  const previewTheme = async (id: string) => {
    const theme = findTheme(id);
    if (!theme) throw new Error(`unknown theme: ${id}`);
    if (!previewBase) previewBase = current;
    applyTheme(theme);
    previewing = true;
    return theme;
  };

  const resetPreview = async () => {
    if (previewing && previewBase) {
      applyTheme(previewBase);
      previewing = false;
      previewBase = null;
    }
  };

  return {
    listThemes: () => [...THEME_OPTIONS],
    getCurrentTheme: () => current,
    setTheme,
    previewTheme,
    resetPreview,
  };
}
