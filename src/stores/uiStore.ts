import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export type FontLoadingState = {
  loading: boolean;
  id: string | null;
  label: string | null;
};

const FONT_SIZE_STORAGE_KEY = "terminal.fontSize";
const DEFAULT_FONT_SIZE = 15;
export const FONT_SIZE_STEP = 5;
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 30;

const clampFontSize = (size: number) =>
  Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));

const readPersistedFontSize = (): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampFontSize(parsed) : null;
  } catch {
    return null;
  }
};

const persistFontSize = (value: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
};

type UiStore = {
  fontLoading: FontLoadingState;
  setFontLoading: (state: FontLoadingState) => void;
  clearFontLoading: () => void;
  terminalFontSize: number;
  setTerminalFontSize: (size: number) => void;
};

// Global UI store for lightweight cross-cutting UI signals (e.g., font loading)
export const useUiStore = create<UiStore>((set) => ({
  fontLoading: { loading: false, id: null, label: null },
  setFontLoading: (state) => set({ fontLoading: state }),
  clearFontLoading: () =>
    set({ fontLoading: { loading: false, id: null, label: null } }),
  terminalFontSize: readPersistedFontSize() ?? DEFAULT_FONT_SIZE,
  setTerminalFontSize: (size) => {
    const nextSize = clampFontSize(size);
    persistFontSize(nextSize);
    set({ terminalFontSize: nextSize });
  },
}));

const enqueue = (fn: () => void) => {
  if (typeof queueMicrotask === "function") queueMicrotask(fn);
  else setTimeout(fn, 0);
};

export const setFontLoadingState = (state: FontLoadingState) =>
  enqueue(() => useUiStore.getState().setFontLoading(state));

export const clearFontLoadingState = () =>
  enqueue(() => useUiStore.getState().clearFontLoading());

export { useShallow };
