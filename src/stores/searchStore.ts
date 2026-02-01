import { create } from "zustand";
import { SearchHit } from "@types";

type SearchState = {
  isOpen: boolean;
  isMinimized: boolean;
  query: string;
  hits: SearchHit[];
  total: number;
};

type SearchActions = {
  open: () => void;
  close: () => void;
  minimize: () => void;
  setQuery: (query: string) => void;
  setResults: (hits: SearchHit[], total?: number) => void;
  clear: () => void;
};

export const useSearchStore = create<SearchState & SearchActions>((set) => ({
  isOpen: false,
  isMinimized: false,
  query: "",
  hits: [],
  total: 0,
  open: () => set({ isOpen: true, isMinimized: false }),
  close: () => set({ isOpen: false }),
  minimize: () => set({ isOpen: false, isMinimized: true }),
  setQuery: (query) => set({ query }),
  setResults: (hits, total = hits.length) => set({ hits, total }),
  clear: () => set({ query: "", hits: [], total: 0 }),
}));

// non-hook access for command handlers
export const searchStore = {
  open: () => useSearchStore.getState().open(),
  close: () => useSearchStore.getState().close(),
  minimize: () => useSearchStore.getState().minimize(),
  setQuery: (q: string) => useSearchStore.getState().setQuery(q),
  setResults: (hits: SearchHit[], total?: number) =>
    useSearchStore.getState().setResults(hits, total),
  clear: () => useSearchStore.getState().clear(),
  getState: () => useSearchStore.getState(),
};
