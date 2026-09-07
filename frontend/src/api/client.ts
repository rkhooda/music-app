import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import { MusicTrack } from '../types/music';

const API_PATH = '/api/music';
const DEFAULT_PORT = process.env.EXPO_PUBLIC_API_PORT || '3000';

/** Host that served the JS bundle. On a device this is the dev machine's LAN IP. */
const getDevServerHost = (): string | null => {
  const candidates = [
    NativeModules.SourceCode?.scriptURL,
    Constants.expoConfig?.hostUri ? `http://${Constants.expoConfig.hostUri}` : undefined,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const { hostname } = new URL(candidate);
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') return hostname;
    } catch {
      // ignore malformed values
    }
  }
  return null;
};

const isLoopback = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

/**
 * Resolution order:
 * 1. EXPO_PUBLIC_API_URL (a loopback host there is swapped for the Metro host on devices)
 * 2. Metro host + EXPO_PUBLIC_API_PORT (default 3000)
 * 3. Android emulator alias / localhost
 */
const resolveBaseUrl = (): string => {
  const devHost = getDevServerHost();
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if (isLoopback(url.hostname) && devHost && Platform.OS !== 'web') url.hostname = devHost;
      return url.origin;
    } catch {
      console.warn(`[api] EXPO_PUBLIC_API_URL is not a valid URL: ${configured}`);
    }
  }

  if (devHost) return `http://${devHost}:${DEFAULT_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${DEFAULT_PORT}` : `http://localhost:${DEFAULT_PORT}`;
};

export const API_ORIGIN = resolveBaseUrl();
export const API_BASE_URL = `${API_ORIGIN}${API_PATH}`;

if (__DEV__) console.log(`[api] base url ${API_BASE_URL} (${Platform.OS})`);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'network' | 'timeout' | 'http' | 'aborted',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const describeError = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return `Can't reach the backend at ${API_ORIGIN}. Is it running on the same Wi‑Fi?`;
    if (error.kind === 'timeout') return 'The backend took too long to respond.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
};

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Retry once on network failure only (never on HTTP errors, which are deterministic). */
  retryOnNetworkError?: boolean;
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, timeoutMs = 20_000, signal, retryOnNetworkError = false } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = (payload as { error?: string })?.error || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, 'http');
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw new ApiError('Request cancelled', 0, 'aborted');
    if (timedOut) throw new ApiError('Request timed out', 0, 'timeout');
    if (retryOnNetworkError) {
      return request<T>(path, { ...options, retryOnNetworkError: false });
    }
    throw new ApiError(error instanceof Error ? error.message : 'Network error', 0, 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
};

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const searchMusic = async (query: string, signal?: AbortSignal): Promise<MusicTrack[]> => {
  const payload = await request<{ data: MusicTrack[] }>(`/search?q=${encodeURIComponent(query.trim())}`, {
    signal,
    retryOnNetworkError: true,
    timeoutMs: 15_000,
  });
  return payload.data;
};

export interface ResolvedStream {
  url: string;
  expiresAt: number;
  duration: number | null;
}

/** Resolves (and caches, server-side) the stream so playback errors surface here, not inside the player. */
export const resolveStream = (videoId: string, signal?: AbortSignal) =>
  request<ResolvedStream>(`/url/${videoId}`, { signal, timeoutMs: 35_000 });

/** Non-blocking hint; the backend decides what actually gets extracted. */
export const prefetchStreams = (videoIds: string[], priority: 'next' | 'warm' = 'warm') => {
  const ids = Array.from(new Set(videoIds.filter(Boolean))).slice(0, 10);
  if (ids.length === 0) return Promise.resolve();
  return request('/prefetch', { method: 'POST', body: { ids, priority }, timeoutMs: 5_000 }).catch(() => undefined);
};

export const streamUri = (videoId: string) => `${API_BASE_URL}/stream/${videoId}`;

export interface BackendHealth {
  status: string;
  ytDlp: { ok: boolean; version?: string; error?: string; running: boolean };
  search: string;
  cache: { hits: number; misses: number; joined: number; extractions: number; failures: number; cached: number; inFlight: number; queued: number };
}

export const fetchHealth = async (): Promise<BackendHealth> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${API_ORIGIN}/health`, { signal: controller.signal });
    return (await response.json()) as BackendHealth;
  } finally {
    clearTimeout(timer);
  }
};
