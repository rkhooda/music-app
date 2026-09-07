import { NextFunction, Request, Response } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { config } from '../config';
import { MusicSearchResult, StreamDescriptor, StreamPriority } from '../services/musicTypes';
import { getStream, invalidateStream, prefetchStreams, streamCacheStats } from '../services/streamService';
import { YouTubeDataApiError, isYouTubeDataApiConfigured, searchYouTubeWithDataApi } from '../services/youtubeDataApiService';
import { isYtDlpWorkerRunning, pingYtDlp, searchYouTube } from '../services/ytDlpService';
import logger from '../utils/logger';
import { HttpError } from '../middleware/errorHandler';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_QUERY_LENGTH = 200;
const MAX_PREFETCH_IDS = 10;
const PROXIED_HEADERS = ['accept-ranges', 'cache-control', 'content-length', 'content-range', 'content-type', 'etag', 'last-modified'];

const requireVideoId = (value: unknown): string => {
  if (typeof value !== 'string' || !VIDEO_ID.test(value)) {
    throw new HttpError(400, 'A valid 11-character YouTube video id is required');
  }
  return value;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface SearchEntry {
  results?: MusicSearchResult[];
  expiresAt?: number;
  pending?: Promise<MusicSearchResult[]>;
}

const searchCache = new Map<string, SearchEntry>();

const runSearch = async (query: string): Promise<MusicSearchResult[]> => {
  try {
    return await searchYouTubeWithDataApi(query);
  } catch (error) {
    if (!(error instanceof YouTubeDataApiError && error.shouldFallbackToYtDlp)) throw error;
    logger.warn(`Data API unavailable (${error.message}); falling back to yt-dlp search for "${query}"`);
    return searchYouTube(query);
  }
};

export const searchMusic = async (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  const raw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!raw) return next(new HttpError(400, 'Query parameter "q" is required'));
  if (raw.length > MAX_QUERY_LENGTH) return next(new HttpError(400, `Query must be at most ${MAX_QUERY_LENGTH} characters`));

  const key = raw.toLowerCase();
  const entry = searchCache.get(key);

  try {
    let results: MusicSearchResult[];
    let source: string;

    if (entry?.results && entry.expiresAt && entry.expiresAt > Date.now()) {
      results = entry.results;
      source = 'cache';
    } else if (entry?.pending) {
      results = await entry.pending;
      source = 'joined';
    } else {
      const pending = runSearch(raw);
      searchCache.set(key, { pending });
      results = await pending;
      searchCache.set(key, { results, expiresAt: Date.now() + config.search.ttlMs });
      source = isYouTubeDataApiConfigured() ? 'data-api' : 'yt-dlp';
    }

    res.json({ data: results });
    logger.info(`search "${raw}" ${results.length} results source=${source} took=${Date.now() - startedAt}ms`);

    // Warm the most likely taps only after the response is on the wire.
    prefetchStreams(results.slice(0, config.search.warmTopResults).map((track) => track.id), 'warm');
  } catch (error) {
    searchCache.delete(key);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Stream URL + prefetch
// ---------------------------------------------------------------------------

export const getStreamUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const videoId = requireVideoId(req.params.videoId);
    const descriptor = await getStream(videoId, 'play');
    res.json({ url: descriptor.url, expiresAt: descriptor.expiresAt, duration: descriptor.duration ?? null });
  } catch (error) {
    next(error);
  }
};

export const prefetch = (req: Request, res: Response, next: NextFunction) => {
  const { ids, priority } = (req.body ?? {}) as { ids?: unknown; priority?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_PREFETCH_IDS || !ids.every((id) => typeof id === 'string' && VIDEO_ID.test(id))) {
    return next(new HttpError(400, `ids must be 1-${MAX_PREFETCH_IDS} valid video ids`));
  }

  const resolvedPriority: StreamPriority = priority === 'next' ? 'next' : 'warm';
  prefetchStreams(ids as string[], resolvedPriority);
  res.status(202).json({ queued: ids.length, priority: resolvedPriority });
};

// ---------------------------------------------------------------------------
// Audio proxy
// ---------------------------------------------------------------------------

const isClientGone = (req: Request, res: Response) => req.destroyed || res.writableEnded || res.destroyed;

const isAbort = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error.message.includes('Premature close') || error.message.includes('aborted'));

const fetchUpstream = (descriptor: StreamDescriptor, req: Request, signal: AbortSignal) => {
  const headers: Record<string, string> = { ...descriptor.httpHeaders };
  if (typeof req.headers.range === 'string') headers.Range = req.headers.range;
  if (typeof req.headers['if-range'] === 'string') headers['If-Range'] = req.headers['if-range'];
  return fetch(descriptor.url, {
    headers,
    signal: AbortSignal.any([signal, AbortSignal.timeout(config.stream.upstreamHeaderTimeoutMs)]),
  });
};

/**
 * Proxies the googlevideo stream. YouTube binds stream URLs to the extracting
 * IP, so the backend (which extracted it) must be the one fetching it. A stale
 * URL (403/410) is re-extracted once, transparently.
 */
export const streamAudio = async (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  const abort = new AbortController();
  const onClose = () => abort.abort();
  req.on('close', onClose);

  try {
    const videoId = requireVideoId(req.params.videoId);
    let descriptor = await getStream(videoId, 'play');
    const resolvedAt = Date.now();
    let upstream = await fetchUpstream(descriptor, req, abort.signal);
    let recovered = false;

    if (upstream.status === 403 || upstream.status === 410) {
      logger.warn(`stream ${videoId}: upstream ${upstream.status}, re-extracting`);
      await upstream.body?.cancel().catch(() => undefined);
      invalidateStream(videoId);
      descriptor = await getStream(videoId, 'play');
      upstream = await fetchUpstream(descriptor, req, abort.signal);
      recovered = true;
    }

    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => undefined);
      throw new HttpError(502, `Upstream returned ${upstream.status}`);
    }

    for (const name of PROXIED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (!upstream.headers.get('content-type')) res.setHeader('content-type', 'audio/mp4');
    res.status(upstream.status);

    logger.info(
      `stream ${videoId} ${upstream.status} range=${req.headers.range ?? '-'} resolve=${resolvedAt - startedAt}ms ttfb=${Date.now() - startedAt}ms${recovered ? ' recovered=1' : ''}`,
    );

    if (!upstream.body) {
      res.end();
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body as never), res);
  } catch (error) {
    if (isAbort(error) || isClientGone(req, res)) return;
    next(error);
  } finally {
    req.off('close', onClose);
  }
};

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const health = async (_req: Request, res: Response) => {
  let ytDlp: { ok: boolean; version?: string; error?: string };
  try {
    const pong = await pingYtDlp();
    ytDlp = { ok: true, version: pong.version };
  } catch (error) {
    ytDlp = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  res.status(ytDlp.ok ? 200 : 503).json({
    status: ytDlp.ok ? 'ok' : 'degraded',
    ytDlp: { ...ytDlp, running: isYtDlpWorkerRunning() },
    search: isYouTubeDataApiConfigured() ? 'youtube-data-api' : 'yt-dlp-fallback',
    cache: streamCacheStats(),
  });
};
