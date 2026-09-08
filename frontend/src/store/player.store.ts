import { AudioPlayer, AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { ApiError, describeError, prefetchStreams, resolveStream, streamUri } from '../api/client';
import { perf } from '../lib/perf';
import { MusicTrack } from '../types/music';
import { useDownloadsStore } from './downloads.store';

export type PlaybackSource = 'local' | 'stream';

interface PlayerState {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  currentIndex: number;
  source: PlaybackSource | null;
  /** True from tap until the first audio frame. */
  isLoading: boolean;
  loadingTrackId: string | null;
  isPlaying: boolean;
  /** Stalled mid-track waiting for data. */
  isBuffering: boolean;
  progress: number;
  duration: number;
  shuffle: boolean;
  error: string | null;
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => Promise<void>;
  togglePlayback: () => void;
  seekTo: (seconds: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  toggleShuffle: () => void;
  clearError: () => void;
}

// Expo Go never runs the expo-audio config plugin, so AudioControlsService is absent from
// its manifest: background playback and lock screen controls fail to bind and log native
// errors. Any real build has the service. appOwnership is the only check that separates
// Expo Go from a dev client (executionEnvironment reports both as storeClient).
const IS_EXPO_GO = Constants.appOwnership === 'expo';

const LOAD_TIMEOUT_MS = 30_000;
const NEXT_PREFETCH_COUNT = 2;

// One player for the life of the app; sources are swapped with replace().
let player: AudioPlayer | null = null;
let audioModeReady = false;
let requestToken = 0;
let loadedAt = 0;
let loadTimer: ReturnType<typeof setTimeout> | null = null;
let resolveAbort: AbortController | null = null;
let seeking = false;
// Android reports didJustFinish on every status event while ENDED; act on it once per load.
let endedHandled = false;

const ensureAudioMode = async () => {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: !IS_EXPO_GO, interruptionMode: 'doNotMix' });
  } catch (error) {
    console.warn('[player] audio mode', error);
  }
};

const clearLoadTimer = () => {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = null;
};

const setLockScreen = (audio: AudioPlayer, track: MusicTrack) => {
  if (IS_EXPO_GO) return;
  try {
    audio.setActiveForLockScreen(
      true,
      { title: track.title, artist: track.artist, artworkUrl: track.thumbnail },
      { showSeekBackward: false, showSeekForward: false },
    );
  } catch {
    // Not supported in this runtime (e.g. web); playback still works.
  }
};

export const usePlayerStore = create<PlayerState>((set, get) => {
  const handleStatus = (status: AudioStatus) => {
    const state = get();
    const track = state.currentTrack;
    if (!track) return;

    const started = state.isLoading && status.playing;
    if (started) {
      clearLoadTimer();
      perf.audioStarted(track.id);
    }

    set({
      isPlaying: status.playing,
      isBuffering: !status.playing && status.isBuffering && !state.isLoading,
      isLoading: started ? false : state.isLoading,
      loadingTrackId: started ? null : state.loadingTrackId,
      duration: status.duration > 0 ? status.duration : state.duration,
      ...(seeking ? {} : { progress: status.currentTime }),
    });

    // Guard against a stale finish event from the previous source right after replace().
    if (status.didJustFinish && !endedHandled && Date.now() - loadedAt > 1500) {
      endedHandled = true;
      void handleTrackEnded();
    }
  };

  const getPlayer = (): AudioPlayer => {
    if (player) return player;
    player = createAudioPlayer(null, { updateInterval: 250 });
    player.addListener('playbackStatusUpdate', handleStatus);
    return player;
  };

  const handleTrackEnded = async () => {
    const { queue, currentIndex, shuffle } = get();
    const hasNext = shuffle ? queue.length > 1 : currentIndex < queue.length - 1;
    if (hasNext) {
      await get().skipNext();
      return;
    }
    getPlayer().pause();
    set({ isPlaying: false });
  };

  const armLoadTimeout = (token: number, trackId: string) => {
    clearLoadTimer();
    loadTimer = setTimeout(() => {
      if (token !== requestToken || !get().isLoading) return;
      perf.cancel(trackId);
      getPlayer().pause();
      set({ isLoading: false, loadingTrackId: null, isPlaying: false, error: "Playback didn't start. Check the backend and your connection." });
    }, LOAD_TIMEOUT_MS);
  };

  const pickNextIndex = (direction: 1 | -1) => {
    const { queue, currentIndex, shuffle } = get();
    if (queue.length === 0) return -1;
    if (shuffle && queue.length > 1) {
      let candidate = currentIndex;
      while (candidate === currentIndex) candidate = Math.floor(Math.random() * queue.length);
      return candidate;
    }
    const next = currentIndex + direction;
    return next >= 0 && next < queue.length ? next : -1;
  };

  return {
    currentTrack: null,
    queue: [],
    currentIndex: -1,
    source: null,
    isLoading: false,
    loadingTrackId: null,
    isPlaying: false,
    isBuffering: false,
    progress: 0,
    duration: 0,
    shuffle: false,
    error: null,

    clearError: () => set({ error: null }),
    toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

    playTrack: async (track, queue) => {
      const token = ++requestToken;
      const state = get();
      const nextQueue = queue && queue.length > 0 ? queue : state.queue.some((item) => item.id === track.id) ? state.queue : [track];
      const nextIndex = Math.max(0, nextQueue.findIndex((item) => item.id === track.id));
      const localUri = useDownloadsStore.getState().localUriFor(track.id);
      const source: PlaybackSource = localUri ? 'local' : 'stream';

      perf.tap(track.id, source);
      resolveAbort?.abort();
      resolveAbort = null;

      set({
        currentTrack: track,
        queue: nextQueue,
        currentIndex: nextIndex,
        source,
        isLoading: true,
        loadingTrackId: track.id,
        isPlaying: false,
        isBuffering: false,
        progress: 0,
        duration: track.duration || 0,
        error: null,
      });

      await ensureAudioMode();
      if (token !== requestToken) return;

      const audio = getPlayer();
      loadedAt = Date.now();
      endedHandled = false;
      audio.replace({ uri: localUri ?? streamUri(track.id) });
      audio.play();
      armLoadTimeout(token, track.id);
      setLockScreen(audio, track);

      if (!localUri) {
        // Resolve in parallel with the player's own request: the backend dedupes the
        // extraction, and this is where a precise error message comes from.
        const controller = new AbortController();
        resolveAbort = controller;
        resolveStream(track.id, controller.signal)
          .then((resolved) => {
            if (token !== requestToken) return;
            perf.resolved(track.id);
            if (resolved.duration && !get().duration) set({ duration: resolved.duration });
          })
          .catch((error: unknown) => {
            if (token !== requestToken || (error instanceof ApiError && error.kind === 'aborted')) return;
            clearLoadTimer();
            perf.cancel(track.id);
            audio.pause();
            set({ isLoading: false, loadingTrackId: null, isPlaying: false, error: describeError(error) });
          });
      } else {
        perf.resolved(track.id);
      }

      const upcoming = nextQueue
        .slice(nextIndex + 1, nextIndex + 1 + NEXT_PREFETCH_COUNT)
        .filter((item) => !useDownloadsStore.getState().localUriFor(item.id))
        .map((item) => item.id);
      if (upcoming.length > 0) void prefetchStreams(upcoming, 'next');
    },

    togglePlayback: () => {
      const { isPlaying, isLoading, currentTrack, progress, duration } = get();
      if (!currentTrack || !player) return;

      if (isLoading) {
        // A second tap while loading cancels the load.
        requestToken += 1;
        clearLoadTimer();
        resolveAbort?.abort();
        perf.cancel(currentTrack.id);
        player.pause();
        set({ isLoading: false, loadingTrackId: null, isPlaying: false });
        return;
      }

      if (isPlaying) {
        player.pause();
        set({ isPlaying: false });
        return;
      }

      if (duration > 0 && progress >= duration - 0.5) {
        endedHandled = false;
        void player.seekTo(0);
      }
      player.play();
      set({ isPlaying: true });
    },

    seekTo: async (seconds) => {
      if (!player || !get().currentTrack) return;
      seeking = true;
      set({ progress: seconds });
      try {
        await player.seekTo(seconds);
      } finally {
        seeking = false;
      }
    },

    skipNext: async () => {
      const index = pickNextIndex(1);
      if (index < 0) return;
      await get().playTrack(get().queue[index], get().queue);
    },

    skipPrevious: async () => {
      const { progress, queue } = get();
      const index = pickNextIndex(-1);
      if (progress > 4 || index < 0) {
        await get().seekTo(0);
        return;
      }
      await get().playTrack(queue[index], queue);
    },
  };
});
