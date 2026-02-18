import { clearFontLoadingState } from "@stores/uiStore";

export type TerminalColorOption = {
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
  chipColor?: string;
  chipHoverColor?: string;
  chipActiveShadow?: string;
};

export type TerminalColorController = {
  listColors: () => TerminalColorOption[];
  getCurrentColor: () => TerminalColorOption;
  setColor: (id: string) => Promise<TerminalColorOption>;
  previewColor: (id: string) => Promise<TerminalColorOption>;
  resetPreview: () => Promise<void>;
};

const STORAGE_KEY = "terminal.color";
const DEFAULT_COLOR_ID = "night_sky";

const buildLayer = (base: string, a: string, b: string) =>
  `radial-gradient(circle at 18% 18%, ${a}, transparent 38%), radial-gradient(circle at 82% 12%, ${b}, transparent 32%), ${base}`;

const COLOR_OPTIONS: TerminalColorOption[] = [
  // =========================
  // COLORFUL (light / dark)
  // =========================
  {
    id: "colorful_light",
    label: "Colorful Light",
    group: "light",
    tone: "light",
    description: "Warm luminous paper + high-contrast ink",
    background: "#fff7e8",
    layer: buildLayer(
      "#fff7e8",
      "rgba(255, 179, 71, 0.26)",
      "rgba(255, 120, 180, 0.14)",
    ),
    surface: "#fffaf2",
    text: "#1b1207",
    muted: "#4b3a2a",
    accent: "#c2410c",
    border: "rgba(27, 18, 7, 0.14)",
    card: "rgba(255, 255, 255, 0.92)",
    shadow: "0 18px 60px rgba(27, 18, 7, 0.16)",
    selection: "rgba(194, 65, 12, 0.18)",
    selectionText: "#1b1207",
    caret: "#1b1207",
    chipBg:
      "linear-gradient(180deg, rgba(27, 18, 7, 0.06), rgba(27, 18, 7, 0.02) 55%, rgba(27, 18, 7, 0.04))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(27, 18, 7, 0.12), rgba(27, 18, 7, 0.06) 55%, rgba(27, 18, 7, 0.08))",
  },
  {
    id: "colorful_dark",
    label: "Colorful Dark",
    group: "dark",
    tone: "dark",
    description: "Deep charcoal + vivid ember accent",
    background: "#07060a",
    layer: buildLayer(
      "#07060a",
      "rgba(255, 122, 24, 0.18)",
      "rgba(255, 64, 129, 0.10)",
    ),
    surface: "#0c0b11",
    text: "#f5f2ff",
    muted: "#cdc7e6",
    accent: "#ff7a18",
    border: "rgba(255, 255, 255, 0.16)",
    card: "rgba(255, 255, 255, 0.07)",
    shadow: "0 24px 78px rgba(0, 0, 0, 0.68)",
    selection: "rgba(255, 122, 24, 0.28)",
    caret: "#f5f2ff",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.30))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08) 50%, rgba(0, 0, 0, 0.38))",
  },

  // =========================
  // LOVELY (light / dark)
  // =========================
  {
    id: "lovely_light",
    label: "Lovely Light",
    group: "light",
    tone: "light",
    description: "Blush cream + plum ink (soft, still sharp)",
    background: "#fff4f6",
    layer: buildLayer(
      "#fff4f6",
      "rgba(255, 105, 180, 0.18)",
      "rgba(148, 93, 214, 0.10)",
    ),
    surface: "#fff8fa",
    text: "#23121b",
    muted: "#513443",
    accent: "#b4236a",
    border: "rgba(35, 18, 27, 0.14)",
    card: "rgba(255, 255, 255, 0.94)",
    shadow: "0 18px 60px rgba(35, 18, 27, 0.14)",
    selection: "rgba(180, 35, 106, 0.16)",
    selectionText: "#23121b",
    caret: "#23121b",
    chipBg:
      "linear-gradient(180deg, rgba(35, 18, 27, 0.06), rgba(35, 18, 27, 0.02) 55%, rgba(35, 18, 27, 0.04))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(35, 18, 27, 0.12), rgba(35, 18, 27, 0.06) 55%, rgba(35, 18, 27, 0.08))",
  },
  {
    id: "lovely_dark",
    label: "Lovely Dark",
    group: "dark",
    tone: "dark",
    description: "Blackberry night + rose highlight",
    background: "#07050a",
    layer:
      "radial-gradient(120% 140% at 18% 18%, rgba(255, 105, 180, 0.20), transparent 44%)," +
      "radial-gradient(120% 140% at 82% 22%, rgba(167, 139, 250, 0.18), transparent 42%)," +
      "#07050a",
    surface: "#0c0a10",
    text: "#fff6fb",
    muted: "#e1cbd8",
    accent: "#ff6aa9",
    border: "rgba(255, 255, 255, 0.16)",
    card: "rgba(255, 255, 255, 0.08)",
    shadow: "0 26px 80px rgba(0, 0, 0, 0.70)",
    selection: "rgba(255, 106, 169, 0.26)",
    caret: "#fff6fb",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.30))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.10) 50%, rgba(0, 0, 0, 0.40))",
  },

  // =========================
  // AURORA (light / dark)
  // =========================
  {
    id: "aurora_light",
    label: "Aurora Light",
    group: "light",
    tone: "light",
    description: "Cool near-white + aurora haze (keeps text solid)",
    background: "#f3fbff",
    layer:
      "radial-gradient(120% 140% at 14% 18%, rgba(0, 209, 255, 0.14), transparent 46%)," +
      "radial-gradient(120% 140% at 82% 22%, rgba(99, 102, 241, 0.12), transparent 44%)," +
      "radial-gradient(120% 140% at 46% 78%, rgba(34, 197, 94, 0.10), transparent 48%)," +
      "#f3fbff",
    surface: "#f7fcff",
    text: "#08111f",
    muted: "#2f415c",
    accent: "#0ea5e9",
    border: "rgba(8, 17, 31, 0.14)",
    card: "rgba(255, 255, 255, 0.92)",
    shadow: "0 18px 60px rgba(8, 17, 31, 0.14)",
    selection: "rgba(14, 165, 233, 0.16)",
    selectionText: "#08111f",
    caret: "#08111f",
    chipBg:
      "linear-gradient(180deg, rgba(8, 17, 31, 0.06), rgba(8, 17, 31, 0.02) 55%, rgba(8, 17, 31, 0.04))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(8, 17, 31, 0.12), rgba(8, 17, 31, 0.06) 55%, rgba(8, 17, 31, 0.08))",
  },
  {
    id: "aurora_dark",
    label: "Aurora Dark",
    group: "dark",
    tone: "dark",
    description: "Teal-violet aurora with restrained glare",
    background: "#060b18",
    layer:
      "linear-gradient(145deg, #0a1630 0%, #0a2326 28%, #0b2b22 56%, #101a34 78%, #0f0820 100%)",
    surface: "#0a1022",
    text: "#eaf4ff",
    muted: "#c8d7ee",
    accent: "#5fffd7",
    border: "rgba(255, 255, 255, 0.14)",
    card: "rgba(255, 255, 255, 0.06)",
    shadow: "0 26px 80px rgba(2, 6, 18, 0.62)",
    selection: "rgba(95, 255, 215, 0.22)",
    caret: "#eaf4ff",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03) 48%, rgba(0, 0, 0, 0.22))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08) 48%, rgba(0, 0, 0, 0.32))",
  },

  // =========================
  // CLARITY (light / dark)
  // =========================
  {
    id: "clarity_light",
    label: "Clarity Light",
    group: "light",
    tone: "light",
    description: "Minimal, print-like contrast (no tinty whites)",
    background: "#fafafa",
    layer: buildLayer(
      "#fafafa",
      "rgba(2, 6, 23, 0.06)",
      "rgba(2, 6, 23, 0.03)",
    ),
    surface: "#ffffff",
    text: "#0b0f19",
    muted: "#2b3445",
    accent: "#2563eb",
    border: "rgba(11, 15, 25, 0.14)",
    card: "rgba(255, 255, 255, 0.96)",
    shadow: "0 16px 55px rgba(11, 15, 25, 0.12)",
    selection: "rgba(37, 99, 235, 0.16)",
    selectionText: "#0b0f19",
    caret: "#0b0f19",
    chipBg:
      "linear-gradient(180deg, rgba(11, 15, 25, 0.06), rgba(11, 15, 25, 0.02) 55%, rgba(11, 15, 25, 0.04))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(11, 15, 25, 0.12), rgba(11, 15, 25, 0.06) 55%, rgba(11, 15, 25, 0.08))",
  },
  {
    id: "clarity_dark",
    label: "Clarity Dark",
    group: "dark",
    tone: "dark",
    description: "Neutral near-black + neutral near-white (lowest fatigue)",
    background: "#0b0c0f",
    layer: buildLayer(
      "#0b0c0f",
      "rgba(255, 255, 255, 0.06)",
      "rgba(255, 255, 255, 0.03)",
    ),
    surface: "#0f1116",
    text: "#f2f4f8",
    muted: "#c7cbd6",
    accent: "#60a5fa",
    border: "rgba(255, 255, 255, 0.14)",
    card: "rgba(255, 255, 255, 0.06)",
    shadow: "0 24px 78px rgba(0, 0, 0, 0.62)",
    selection: "rgba(96, 165, 250, 0.22)",
    caret: "#f2f4f8",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04) 50%, rgba(0, 0, 0, 0.28))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08) 50%, rgba(0, 0, 0, 0.36))",
  },

  {
    id: "night_sky",
    label: "Night Sky",
    group: "dark",
    tone: "dark",
    description: "Deep indigo night with subtle star-ready contrast",
    background: "#050711",
    layer:
      "radial-gradient(130% 150% at 16% 12%, rgba(116, 131, 255, 0.14), transparent 48%)," +
      "radial-gradient(130% 140% at 82% 10%, rgba(146, 99, 255, 0.10), transparent 46%)," +
      "linear-gradient(160deg, #050711 0%, #060a16 44%, #070b1b 100%)",
    surface: "rgba(10, 15, 31, 0.85)",
    text: "#eef3ff",
    muted: "#c7d0ee",
    accent: "#9dc3ff",
    border: "rgba(230, 239, 255, 0.2)",
    card: "rgba(255, 255, 255, 0.06)",
    shadow: "0 30px 82px rgba(1, 4, 18, 0.72)",
    selection: "rgba(157, 195, 255, 0.24)",
    caret: "#f3f7ff",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08) 52%, rgba(6, 10, 22, 0.62))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.27), rgba(255, 255, 255, 0.11) 52%, rgba(6, 10, 22, 0.68))",
    chipColor: "#f2f7ff",
    chipHoverColor: "#ffffff",
    chipActiveShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.72)",
  },

  {
    id: "hacker_dark",
    label: "Hacker (Neon)",
    group: "dark",
    tone: "dark",
    description: "Neon green on near-black, low-glare",
    background: "#050607",
    layer:
      "radial-gradient(120% 140% at 18% 18%, rgba(0, 255, 136, 0.16), transparent 46%)," +
      "radial-gradient(120% 140% at 82% 22%, rgba(0, 208, 255, 0.12), transparent 44%)," +
      "radial-gradient(120% 140% at 52% 82%, rgba(255, 0, 255, 0.10), transparent 48%)," +
      "#050607",
    surface: "#090b0d",
    text: "#eafff4",
    muted: "#b7f3d4",
    accent: "#00ff88",
    border: "rgba(234, 255, 244, 0.16)",
    card: "rgba(255, 255, 255, 0.06)",
    shadow: "0 26px 80px rgba(0, 0, 0, 0.72)",
    selection: "rgba(0, 255, 136, 0.26)",
    caret: "#00ff88",
    chipBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04) 50%, rgba(0, 0, 0, 0.32))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08) 50%, rgba(0, 0, 0, 0.40))",
  },

  {
    id: "hacker_light",
    label: "Hacker Light (Neon)",
    group: "light",
    tone: "light",
    description:
      "Off-white + neon accents (less eye-fatigue than pure neon text)",
    background: "#f6fff9",
    layer: buildLayer(
      "#f6fff9",
      "rgba(0, 255, 136, 0.14)",
      "rgba(0, 208, 255, 0.10)",
    ),
    surface: "#fbfffd",
    text: "#06110b",
    muted: "#1f3a2d",
    accent: "#00b85c",
    border: "rgba(6, 17, 11, 0.14)",
    card: "rgba(255, 255, 255, 0.94)",
    shadow: "0 18px 60px rgba(6, 17, 11, 0.14)",
    selection: "rgba(0, 184, 92, 0.18)",
    selectionText: "#06110b",
    caret: "#06110b",
    chipBg:
      "linear-gradient(180deg, rgba(6, 17, 11, 0.06), rgba(6, 17, 11, 0.02) 55%, rgba(6, 17, 11, 0.04))",
    chipHoverBg:
      "linear-gradient(180deg, rgba(6, 17, 11, 0.12), rgba(6, 17, 11, 0.06) 55%, rgba(6, 17, 11, 0.08))",
  },
];

let previewBase: TerminalColorOption | null = null;
let previewing = false;

const findTheme = (id: string) =>
  COLOR_OPTIONS.find((theme) => theme.id.toLowerCase() === id.toLowerCase());

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

const applyTheme = (theme: TerminalColorOption) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.background);
  root.style.setProperty("--bg0", theme.background);
  root.style.setProperty("--bg-layer", theme.layer || theme.background);
  root.style.setProperty("--bg1", theme.surface);
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
  root.style.setProperty(
    "--chip-hover-bg",
    theme.chipHoverBg || theme.chipBg || "var(--card)",
  );
  root.style.setProperty("--chip-border", theme.border);
  root.style.setProperty(
    "--chip-shadow",
    theme.tone === "light"
      ? "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.04), 0 0.5px 0.7px rgba(0,0,0,0.03)"
      : "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.3)",
  );
  root.style.setProperty("--chip-color", theme.chipColor || theme.text);
  root.style.setProperty(
    "--chip-hover-color",
    theme.chipHoverColor || theme.accent || theme.text,
  );
  root.style.setProperty(
    "--chip-active-shadow",
    theme.chipActiveShadow ||
      (theme.tone === "light"
        ? "inset 0 1px 2px rgba(0, 0, 0, 0.38)"
        : "inset 0 1px 2px rgba(0, 0, 0, 0.7)"),
  );
  root.style.setProperty("--button-bg", theme.accent);
  root.style.setProperty(
    "--button-text",
    theme.tone === "light" ? "#0b0f19" : "#f8fbff",
  );
  const suggestBg =
    theme.tone === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(0, 0, 0, 0.6)";
  const suggestActiveBg =
    theme.tone === "light"
      ? "rgba(36, 95, 158, 0.16)"
      : "rgba(141, 208, 255, 0.16)";
  root.style.setProperty("--suggest-bg", suggestBg);
  root.style.setProperty("--suggest-active-bg", suggestActiveBg);
  root.style.setProperty("--suggest-active-color", theme.accent);
  root.style.setProperty(
    "--terminal-cursor",
    encodeCursor(theme.caret, theme.border),
  );
  root.style.setProperty("--terminal-color-scheme", theme.tone);
  root.dataset.terminalColor = theme.id;
  root.dataset.terminalTone = theme.tone;
};

function getInitialTheme(): TerminalColorOption {
  const persisted = readPersisted();
  if (persisted) {
    const hit = findTheme(persisted);
    if (hit) return hit;
  }
  return findTheme(DEFAULT_COLOR_ID) || COLOR_OPTIONS[0];
}

export function createTerminalColorController(): TerminalColorController {
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
    listColors: () => [...COLOR_OPTIONS],
    getCurrentColor: () => current,
    setColor: setTheme,
    previewColor: previewTheme,
    resetPreview,
  };
}
