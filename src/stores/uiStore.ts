import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export type FontLoadingState = {
  loading: boolean;
  id: string | null;
  label: string | null;
};

type UiStore = {
  fontLoading: FontLoadingState;
  setFontLoading: (state: FontLoadingState) => void;
  clearFontLoading: () => void;
};

// Global UI store for lightweight cross-cutting UI signals (e.g., font loading)
export const useUiStore = create<UiStore>((set) => ({
  fontLoading: { loading: false, id: null, label: null },
  setFontLoading: (state) => set({ fontLoading: state }),
  clearFontLoading: () =>
    set({ fontLoading: { loading: false, id: null, label: null } }),
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
