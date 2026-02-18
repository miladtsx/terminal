/**
 * A theme bundles a color (+ palette) with a matching font.
 */
export type TerminalTheme = {
  id: string;
  label: string;
  colorId: string;
  fontId: string;
  description?: string;
};

const THEMES: TerminalTheme[] = [
  {
    id: "hacker",
    label: "Night Owl Engineer",
    colorId: "hacker_dark",
    fontId: "jetbrains",
  },
  {
    id: "paper",
    label: "HR Briefing Room",
    colorId: "clarity_light",
    fontId: "plex",
  },
  {
    id: "aurora",
    label: "Daylight Research Studio",
    colorId: "aurora_dark",
    fontId: "fira",
  },
  {
    id: "color",
    label: "Designer Contrast Studio",
    colorId: "colorful_dark",
    fontId: "space",
  },
  {
    id: "retro",
    label: "Support Desk Soft Mode",
    colorId: "hacker_light",
    fontId: "vt323",
  },
  {
    id: "night_sky",
    label: "Blackhole",
    colorId: "night_sky",
    fontId: "fira",
    description: "Deep Space",
  },
];

const normalize = (value: string) => value.trim().toLowerCase();

export function listThemes(): TerminalTheme[] {
  return [...THEMES];
}

export function findTheme(id: string): TerminalTheme | undefined {
  const target = normalize(id);
  return THEMES.find((pack) => normalize(pack.id) === target);
}

export function matchTheme(
  colorId: string,
  fontId: string,
): TerminalTheme | undefined {
  const color = normalize(colorId);
  const font = normalize(fontId);
  return THEMES.find(
    (pack) => normalize(pack.colorId) === color && normalize(pack.fontId) === font,
  );
}
