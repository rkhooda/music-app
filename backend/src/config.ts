import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const backendRoot = path.resolve(__dirname, '..');

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  isDev: process.env.NODE_ENV !== 'production',
  youtubeApiKey: process.env.YOUTUBE_DATA_API_KEY?.trim() || '',
  ytDlp: {
    python: process.env.YT_DLP_PYTHON?.trim() || path.join(backendRoot, '.venv', 'bin', 'python'),
    workerScript: path.join(backendRoot, 'worker', 'ytdlp_worker.py'),
    // Parallel extractions. Two keeps a user tap from waiting behind one warm job
    // without hammering YouTube from a single IP.
    concurrency: int(process.env.YT_DLP_WORKERS, 2),
    requestTimeoutMs: int(process.env.YT_DLP_TIMEOUT_MS, 30_000),
  },
  search: {
    ttlMs: 24 * 60 * 60 * 1000,
    warmTopResults: 3,
  },
  stream: {
    // Treat a URL as stale this long before YouTube's own expiry so an in-progress
    // song never trips over the boundary.
    expirySkewMs: 5 * 60 * 1000,
    maxCacheEntries: 500,
    upstreamHeaderTimeoutMs: 15_000,
  },
} as const;
