import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setApiOriginOverride } from '../api/client';
import { jsonFileStorage } from '../lib/storage';

interface SettingsState {
  /** Explicit backend origin (e.g. http://100.64.1.2:3000). Empty = auto-detect from Metro / env. */
  backendUrl: string;
  setBackendUrl: (value: string) => string | null;
}

/** Normalises user input into an origin, or returns null when it is empty/invalid. */
export const normalizeBackendUrl = (value: string): string | null => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: '',
      setBackendUrl: (value) => {
        const origin = normalizeBackendUrl(value);
        set({ backendUrl: origin ?? '' });
        setApiOriginOverride(origin);
        return origin;
      },
    }),
    {
      name: 'settings',
      storage: jsonFileStorage(),
      onRehydrateStorage: () => (state) => setApiOriginOverride(normalizeBackendUrl(state?.backendUrl ?? '')),
    },
  ),
);
