import * as FS from 'expo-file-system/legacy';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { streamUri } from '../api/client';
import { jsonFileStorage } from '../lib/storage';
import { MusicTrack } from '../types/music';

export type DownloadStatus = 'queued' | 'downloading' | 'done' | 'failed';

export interface DownloadEntry {
  track: MusicTrack;
  status: DownloadStatus;
  progress: number;
  bytes: number;
  totalBytes: number;
  fileUri?: string;
  error?: string;
  createdAt: number;
}

interface DownloadsState {
  items: Record<string, DownloadEntry>;
  /** Newest first. */
  order: string[];
  enqueue: (track: MusicTrack) => 'queued' | 'exists';
  enqueueMany: (tracks: MusicTrack[]) => number;
  retry: (id: string) => void;
  remove: (id: string) => Promise<void>;
  clearFailed: () => void;
  /** Call once on app start: requeues interrupted downloads and verifies files. */
  resume: () => Promise<void>;
  localUriFor: (id: string) => string | undefined;
}

const DIR = `${FS.documentDirectory}music/`;
const MIN_FREE_BYTES = 50 * 1024 * 1024;
const PROGRESS_INTERVAL_MS = 250;

// ponytail: one download at a time; the backend proxies from a single IP anyway.
let active: { id: string; task: FS.DownloadResumable; cancelled: boolean } | null = null;

const fileFor = (id: string) => `${DIR}${id}.m4a`;

export const useDownloadsStore = create<DownloadsState>()(
  persist(
    (set, get) => {
      const patch = (id: string, changes: Partial<DownloadEntry>) =>
        set((state) => (state.items[id] ? { items: { ...state.items, [id]: { ...state.items[id], ...changes } } } : state));

      const runDownload = async (id: string) => {
        const entry = get().items[id];
        if (!entry) return;
        patch(id, { status: 'downloading', progress: 0, error: undefined });

        const tmp = `${DIR}${id}.part`;
        const target = fileFor(id);

        try {
          await FS.makeDirectoryAsync(DIR, { intermediates: true });
          const free = await FS.getFreeDiskStorageAsync();
          if (free < MIN_FREE_BYTES) throw new Error('Not enough free storage on this device.');

          let lastEmit = 0;
          const task = FS.createDownloadResumable(streamUri(id), tmp, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            const now = Date.now();
            if (now - lastEmit < PROGRESS_INTERVAL_MS) return;
            lastEmit = now;
            patch(id, {
              progress: totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0,
              bytes: totalBytesWritten,
              totalBytes: totalBytesExpectedToWrite,
            });
          });
          active = { id, task, cancelled: false };

          const result = await task.downloadAsync();
          if (!result || active?.cancelled) {
            await FS.deleteAsync(tmp, { idempotent: true });
            return;
          }

          if (result.status !== 200) {
            let message = `Backend returned ${result.status}`;
            try {
              const body = await FS.readAsStringAsync(tmp);
              message = (JSON.parse(body) as { error?: string }).error || message;
            } catch {
              // body was not JSON
            }
            await FS.deleteAsync(tmp, { idempotent: true });
            throw new Error(message);
          }

          await FS.moveAsync({ from: tmp, to: target });
          const info = await FS.getInfoAsync(target);
          const size = info.exists ? info.size : 0;
          patch(id, { status: 'done', progress: 1, fileUri: target, bytes: size, totalBytes: size, error: undefined });
        } catch (error) {
          await FS.deleteAsync(tmp, { idempotent: true }).catch(() => undefined);
          if (get().items[id]) {
            patch(id, { status: 'failed', error: error instanceof Error ? error.message : 'Download failed' });
          }
        } finally {
          active = null;
          pump();
        }
      };

      const pump = () => {
        if (active) return;
        const { items, order } = get();
        const nextId = [...order].reverse().find((id) => items[id]?.status === 'queued');
        if (nextId) void runDownload(nextId);
      };

      return {
        items: {},
        order: [],

        enqueue: (track) => {
          const existing = get().items[track.id];
          if (existing && existing.status !== 'failed') return 'exists';
          set((state) => ({
            items: {
              ...state.items,
              [track.id]: { track, status: 'queued', progress: 0, bytes: 0, totalBytes: 0, createdAt: Date.now() },
            },
            order: [track.id, ...state.order.filter((id) => id !== track.id)],
          }));
          pump();
          return 'queued';
        },

        enqueueMany: (tracks) => {
          let added = 0;
          // Keep playlist order: enqueue in reverse so the first track downloads first.
          [...tracks].reverse().forEach((track) => {
            if (get().enqueue(track) === 'queued') added += 1;
          });
          return added;
        },

        retry: (id) => {
          const entry = get().items[id];
          if (!entry || entry.status !== 'failed') return;
          patch(id, { status: 'queued', progress: 0, error: undefined });
          pump();
        },

        remove: async (id) => {
          if (active?.id === id) {
            active.cancelled = true;
            await active.task.cancelAsync().catch(() => undefined);
          }
          const entry = get().items[id];
          set((state) => {
            const items = { ...state.items };
            delete items[id];
            return { items, order: state.order.filter((item) => item !== id) };
          });
          if (entry?.fileUri) await FS.deleteAsync(entry.fileUri, { idempotent: true }).catch(() => undefined);
          pump();
        },

        clearFailed: () => {
          set((state) => {
            const items = { ...state.items };
            const order = state.order.filter((id) => {
              if (items[id]?.status === 'failed') {
                delete items[id];
                return false;
              }
              return true;
            });
            return { items, order };
          });
        },

        resume: async () => {
          const { items } = get();
          for (const [id, entry] of Object.entries(items)) {
            if (entry.status === 'downloading') {
              patch(id, { status: 'queued', progress: 0 });
            } else if (entry.status === 'done') {
              const info = await FS.getInfoAsync(entry.fileUri || fileFor(id)).catch(() => ({ exists: false }));
              if (!info.exists) patch(id, { status: 'failed', error: 'File is missing', fileUri: undefined, progress: 0 });
            }
          }
          pump();
        },

        localUriFor: (id) => {
          const entry = get().items[id];
          return entry?.status === 'done' ? entry.fileUri : undefined;
        },
      };
    },
    {
      name: 'downloads',
      storage: jsonFileStorage(),
      partialize: (state) => ({ items: state.items, order: state.order }),
    },
  ),
);

export const selectDownloadedTracks = (state: DownloadsState): MusicTrack[] =>
  state.order.filter((id) => state.items[id]?.status === 'done').map((id) => state.items[id].track);

export const selectDownloadedBytes = (state: DownloadsState): number =>
  state.order.reduce((sum, id) => sum + (state.items[id]?.status === 'done' ? state.items[id].bytes : 0), 0);
