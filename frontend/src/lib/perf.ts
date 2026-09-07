import { create } from 'zustand';

/**
 * Development-only timing for the one interaction that matters: tap → audio.
 * Marks are logged to the console and the last sample is kept for a dev badge.
 * Everything is a no-op outside __DEV__.
 */

export interface PerfSample {
  trackId: string;
  source: 'local' | 'stream';
  tapToResolve: number | null;
  resolveToAudio: number | null;
  tapToAudio: number | null;
  at: number;
}

interface PerfState {
  last: PerfSample | null;
  setLast: (sample: PerfSample) => void;
}

export const usePerfStore = create<PerfState>((set) => ({
  last: null,
  setLast: (last) => set({ last }),
}));

interface Pending {
  tapAt: number;
  resolvedAt: number | null;
  source: 'local' | 'stream';
}

const pending = new Map<string, Pending>();

export const perf = {
  tap(trackId: string, source: 'local' | 'stream') {
    if (!__DEV__) return;
    pending.clear();
    pending.set(trackId, { tapAt: Date.now(), resolvedAt: null, source });
  },
  resolved(trackId: string) {
    if (!__DEV__) return;
    const entry = pending.get(trackId);
    if (entry && entry.resolvedAt === null) entry.resolvedAt = Date.now();
  },
  audioStarted(trackId: string) {
    if (!__DEV__) return;
    const entry = pending.get(trackId);
    if (!entry) return;
    pending.delete(trackId);
    const now = Date.now();
    const sample: PerfSample = {
      trackId,
      source: entry.source,
      tapToResolve: entry.resolvedAt ? entry.resolvedAt - entry.tapAt : null,
      resolveToAudio: entry.resolvedAt ? now - entry.resolvedAt : null,
      tapToAudio: now - entry.tapAt,
      at: now,
    };
    console.log(
      `[perf] tap→audio ${sample.tapToAudio}ms (resolve ${sample.tapToResolve ?? '-'}ms, player ${sample.resolveToAudio ?? '-'}ms, ${sample.source}) ${trackId}`,
    );
    usePerfStore.getState().setLast(sample);
  },
  cancel(trackId: string) {
    pending.delete(trackId);
  },
};
