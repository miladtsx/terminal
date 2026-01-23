export type TerminalFontOption = {
  id: string;
  label: string;
  family: string; // full CSS font-family stack
  primary: string; // main font-family name for FontFace loading
  source: "bundled" | "remote";
  href?: string; // remote stylesheet for async load
  description?: string;
};

export type TerminalFontController = {
  listFonts: () => TerminalFontOption[];
  getCurrentFont: () => TerminalFontOption;
  setFont: (id: string) => Promise<TerminalFontOption>;
  warmFonts: () => void;
  previewFont: (id: string) => Promise<TerminalFontOption>;
  resetPreview: () => Promise<void>;
};

const STORAGE_KEY = "terminal.font";
const DEFAULT_FONT_ID = "fira";

const FONT_OPTIONS: TerminalFontOption[] = [
  {
    id: "fira",
    label: "Fira Code (default)",
    primary: "Fira Code",
    family:
      '"Fira Code", "IBM Plex Mono", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", monospace',
    source: "bundled",
    description: "Balanced coding font.",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    primary: "JetBrains Mono",
    family:
      '"JetBrains Mono", "Fira Code", "SFMono-Regular", "Menlo", "Consolas", monospace',
    source: "remote",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap",
    description: "Crisp, spacious developer font.",
  },
  {
    id: "plex",
    label: "IBM Plex Mono",
    primary: "IBM Plex Mono",
    family:
      '"IBM Plex Mono", "Fira Code", "SFMono-Regular", "Menlo", "Consolas", monospace',
    source: "remote",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap",
    description: "Calm neo-grotesque with clean weights.",
  },
  {
    id: "space",
    label: "Space Mono",
    primary: "Space Mono",
    family:
      '"Space Mono", "Fira Code", "SFMono-Regular", "Menlo", "Consolas", monospace',
    source: "remote",
    href: "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",
    description: "Playful geometric with a sci‑fi vibe.",
  },
  {
    id: "vt323",
    label: "VT323",
    primary: "VT323",
    family: '"VT323", "Fira Code", "SFMono-Regular", monospace',
    source: "remote",
    href: "https://fonts.googleapis.com/css2?family=VT323&display=swap",
    description: "Retro terminal / digital readout feel.",
  },
];

const loadedFonts = new Set<string>();
let previewBase: TerminalFontOption | null = null;
let previewing = false;

function getOption(id: string): TerminalFontOption | undefined {
  return FONT_OPTIONS.find((item) => item.id === id);
}

function persistFont(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function readPersistedFont(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setCssVariable(family: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--terminal-font", family);
}

function loadStylesheetOnce(href: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve();
      return;
    }

    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      return;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.addEventListener("load", () => {
      link.dataset.loaded = "true";
      resolve();
    });
    link.addEventListener("error", () => resolve());
    document.head.appendChild(link);
  });
}

async function ensureLoaded(option: TerminalFontOption): Promise<void> {
  if (loadedFonts.has(option.id)) return;
  if (option.source === "remote" && option.href) {
    await loadStylesheetOnce(option.href, `font-${option.id}`);
  }

  if (typeof document !== "undefined" && (document as any).fonts?.load) {
    try {
      await (document as any).fonts.load(`400 1rem ${option.primary}`);
    } catch {
      // ignore font load failures; fallback stack will be used.
    }
  }

  loadedFonts.add(option.id);
}

function getInitialFontId(): string {
  const persisted = readPersistedFont();
  if (persisted && getOption(persisted)) return persisted;
  return DEFAULT_FONT_ID;
}

export function createTerminalFontController(): TerminalFontController {
  let currentId = getInitialFontId();
  const currentOption = getOption(currentId) || FONT_OPTIONS[0];
  setCssVariable(currentOption.family);
  void ensureLoaded(currentOption);

  const setFont = async (id: string) => {
    const option = getOption(id);
    if (!option) throw new Error(`unknown font: ${id}`);
    await ensureLoaded(option);
    currentId = option.id;
    persistFont(option.id);
    setCssVariable(option.family);
    previewBase = null;
    previewing = false;
    return option;
  };

  const previewFont = async (id: string) => {
    const option = getOption(id);
    if (!option) throw new Error(`unknown font: ${id}`);
    if (!previewBase) previewBase = getOption(currentId) || FONT_OPTIONS[0];
    await ensureLoaded(option);
    setCssVariable(option.family);
    previewing = true;
    return option;
  };

  const resetPreview = async () => {
    if (!previewing || !previewBase) return;
    await ensureLoaded(previewBase);
    setCssVariable(previewBase.family);
    previewing = false;
    previewBase = null;
  };

  const listFonts = () => [...FONT_OPTIONS];
  const getCurrentFont = () => getOption(currentId) || FONT_OPTIONS[0];

  const warmFonts = () => {
    // kick off background loading without blocking paint
    const run = () => {
      FONT_OPTIONS.filter((opt) => opt.id !== currentId).forEach((opt, idx) => {
        window.setTimeout(() => {
          void ensureLoaded(opt);
        }, 200 * idx + 200);
      });
    };

    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 800);
    }
  };

  return {
    listFonts,
    getCurrentFont,
    setFont,
    warmFonts,
    previewFont,
    resetPreview,
  };
}
