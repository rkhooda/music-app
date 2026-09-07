import { config } from '../config';
import logger from '../utils/logger';
import { StreamDescriptor, StreamPriority } from './musicTypes';
import { extractStream } from './ytDlpService';

/**
 * videoId → stream descriptor cache with in-flight deduplication and a priority
 * queue in front of the yt-dlp worker.
 *
 * - Fresh cache entry: returned synchronously.
 * - Extraction already running/queued: callers attach to the same promise; a
 *   higher-priority caller promotes the queued job.
 * - Otherwise a job is queued. At most `config.ytDlp.concurrency` run at once and
 *   user taps ('play') always dequeue before 'next' and 'warm'.
 *
 * ponytail: a running warm job is not preempted; a tap waits ≤ one extraction
 * (~1.5 s) for a slot. Add worker-side cancellation if that ever shows up in logs.
 */

const RANK: Record<StreamPriority, number> = { play: 0, next: 1, warm: 2 };

interface Job {
  videoId: string;
  priority: StreamPriority;
  enqueuedAt: number;
  promise: Promise<StreamDescriptor>;
  resolve: (descriptor: StreamDescriptor) => void;
  reject: (error: Error) => void;
  started: boolean;
}

interface Entry {
  descriptor?: StreamDescriptor;
  job?: Job;
  lastUsedAt: number;
}

const cache = new Map<string, Entry>();
const queue: Job[] = [];
let active = 0;

const stats = { hits: 0, misses: 0, joined: 0, extractions: 0, failures: 0 };

const isFresh = (descriptor?: StreamDescriptor): descriptor is StreamDescriptor =>
  Boolean(descriptor && descriptor.expiresAt - config.stream.expirySkewMs > Date.now());

const evictIfNeeded = () => {
  if (cache.size <= config.stream.maxCacheEntries) return;
  let oldestKey: string | null = null;
  let oldest = Infinity;
  for (const [key, entry] of cache) {
    if (!entry.job && entry.lastUsedAt < oldest) {
      oldest = entry.lastUsedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
};

const pump = () => {
  while (active < config.ytDlp.concurrency && queue.length > 0) {
    queue.sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.enqueuedAt - b.enqueuedAt);
    const job = queue.shift()!;
    job.started = true;
    active += 1;
    stats.extractions += 1;
    const startedAt = Date.now();
    const waited = startedAt - job.enqueuedAt;

    extractStream(job.videoId)
      .then((descriptor) => {
        cache.set(job.videoId, { descriptor, lastUsedAt: Date.now() });
        evictIfNeeded();
        logger.info(
          `extract ok ${job.videoId} priority=${job.priority} waited=${waited}ms took=${Date.now() - startedAt}ms ttl=${Math.round((descriptor.expiresAt - Date.now()) / 60000)}min`,
        );
        job.resolve(descriptor);
      })
      .catch((error: Error) => {
        stats.failures += 1;
        cache.delete(job.videoId);
        logger.warn(`extract failed ${job.videoId} priority=${job.priority} after ${Date.now() - startedAt}ms: ${error.message}`);
        job.reject(error);
      })
      .finally(() => {
        active -= 1;
        pump();
      });
  }
};

export const getStream = (videoId: string, priority: StreamPriority = 'play'): Promise<StreamDescriptor> => {
  const entry = cache.get(videoId);

  if (entry && isFresh(entry.descriptor)) {
    stats.hits += 1;
    entry.lastUsedAt = Date.now();
    return Promise.resolve(entry.descriptor);
  }

  if (entry?.job) {
    stats.joined += 1;
    const job = entry.job;
    if (!job.started && RANK[priority] < RANK[job.priority]) {
      job.priority = priority;
    }
    return job.promise;
  }

  stats.misses += 1;
  let resolve!: Job['resolve'];
  let reject!: Job['reject'];
  const promise = new Promise<StreamDescriptor>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const job: Job = { videoId, priority, enqueuedAt: Date.now(), promise, resolve, reject, started: false };
  cache.set(videoId, { job, lastUsedAt: Date.now() });
  queue.push(job);
  pump();
  return promise;
};

/** Fire-and-forget warm-up; failures are logged, never thrown. */
export const prefetchStreams = (videoIds: string[], priority: StreamPriority = 'warm') => {
  for (const videoId of new Set(videoIds)) {
    getStream(videoId, priority).catch(() => undefined);
  }
};

export const invalidateStream = (videoId: string) => {
  const entry = cache.get(videoId);
  if (entry && !entry.job) cache.delete(videoId);
};

export const peekStream = (videoId: string): StreamDescriptor | undefined => {
  const entry = cache.get(videoId);
  return entry && isFresh(entry.descriptor) ? entry.descriptor : undefined;
};

export const streamCacheStats = () => ({
  ...stats,
  cached: Array.from(cache.values()).filter((entry) => isFresh(entry.descriptor)).length,
  inFlight: active,
  queued: queue.length,
});
