import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonFileStorage } from '../lib/storage';

interface SearchState {
  searchHistory: string[];
  addSearchQuery: (query: string) => void;
  removeSearchQuery: (query: string) => void;
  clearSearchHistory: () => void;
}

const MAX_HISTORY = 15;

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      searchHistory: [],
      addSearchQuery: (query) => {
        const trimmed = query.trim();
        if (!trimmed) return;
        set((state) => ({
          searchHistory: [trimmed, ...state.searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_HISTORY),
        }));
      },
      removeSearchQuery: (query) => set((state) => ({ searchHistory: state.searchHistory.filter((item) => item !== query) })),
      clearSearchHistory: () => set({ searchHistory: [] }),
    }),
    { name: 'search-history', storage: jsonFileStorage() },
  ),
);
