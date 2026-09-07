import { ChildProcess, spawn } from 'child_process';
import { config } from '../config';
import logger from '../utils/logger';
import { MusicSearchResult, StreamDescriptor } from './musicTypes';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

const SETUP_HINT = 'yt-dlp worker unavailable. Run `npm run setup` in backend/ (creates .venv with yt-dlp) or set YT_DLP_PYTHON.';

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/** Maps raw yt-dlp errors to an HTTP status and a message a user can act on. */
export const describeYtDlpError = (raw: string): ExtractionError => {
  const has = (pattern: RegExp) => pattern.test(raw);
  if (has(/unavailable|private video|has been removed|does not exist/i)) return new ExtractionError('This video is unavailable.', 404);
  if (has(/DRM/)) return new ExtractionError('This video is DRM protected and cannot be streamed.', 422);
  if (has(/PO Token/i)) return new ExtractionError('YouTube requires a PO token for this video; extraction is not possible right now.', 502);
  if (has(/Too Many Requests|429/)) return new ExtractionError('YouTube rate-limited this machine. Try again in a few minutes.', 503);
  if (has(/confirm you.*bot/i)) return new ExtractionError('YouTube blocked extraction. Set YT_DLP_COOKIES_FROM_BROWSER or YT_DLP_COOKIES_FILE in backend/.env.', 503);
  if (has(/Requested format is not available/)) return new ExtractionError('No playable audio format was found for this video.', 422);
  if (has(/timed out|timeout/i)) return new ExtractionError('YouTube did not respond in time.', 504);
  if (has(/worker (unavailable|exited|stopped|stdin)/)) return new ExtractionError(raw, 503);
  return new ExtractionError(raw || 'Failed to extract audio stream', 502);
};

/**
 * Supervises one long-lived Python worker. Requests are correlated by id, time out
 * independently, and all fail fast if the worker dies (it is respawned lazily).
 */
class YtDlpWorker {
  private child: ChildProcess | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private stdoutBuffer = '';
  private lastSpawnAt = 0;

  get isRunning() {
    return this.child !== null;
  }

  request<T>(payload: Record<string, unknown>, timeoutMs = config.ytDlp.requestTimeoutMs): Promise<T> {
    const child = this.ensureChild();
    const id = this.nextId++;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('yt-dlp timed out'));
      }, timeoutMs);

      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });

      const ok = child.stdin?.write(`${JSON.stringify({ id, ...payload })}\n`);
      if (!ok && !child.stdin?.writable) {
        this.settle(id, new Error('yt-dlp worker stdin closed'));
      }
    });
  }

  stop() {
    if (!this.child) return;
    const child = this.child;
    this.child = null;
    child.kill('SIGTERM');
    this.rejectAll(new Error('yt-dlp worker stopped'));
  }

  private ensureChild(): ChildProcess {
    if (this.child) return this.child;

    // ponytail: no backoff beyond 1s; a crash loop just surfaces as slow failures in logs.
    const sinceLast = Date.now() - this.lastSpawnAt;
    if (sinceLast < 1000) {
      throw new Error(SETUP_HINT);
    }
    this.lastSpawnAt = Date.now();

    const child = spawn(config.ytDlp.python, [config.ytDlp.workerScript, String(config.ytDlp.concurrency)], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    this.child = child;
    this.stdoutBuffer = '';

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => this.onStdout(chunk));
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) logger.warn(`[yt-dlp worker] ${text}`);
    });
    child.on('error', (error) => {
      logger.error(`yt-dlp worker failed to start: ${error.message}. ${SETUP_HINT}`);
      this.child = null;
      this.rejectAll(new Error(SETUP_HINT));
    });
    child.on('exit', (code, signal) => {
      if (this.child === child) {
        logger.error(`yt-dlp worker exited (code=${code} signal=${signal})`);
        this.child = null;
      }
      this.rejectAll(new Error('yt-dlp worker exited'));
    });

    logger.info(`yt-dlp worker started (pid=${child.pid}, threads=${config.ytDlp.concurrency})`);
    return child;
  }

  private onStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    let newline = this.stdoutBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) this.onLine(line);
      newline = this.stdoutBuffer.indexOf('\n');
    }
  }

  private onLine(line: string) {
    let message: WorkerResponse;
    try {
      message = JSON.parse(line) as WorkerResponse;
    } catch {
      logger.warn(`[yt-dlp worker] unparseable line: ${line.slice(0, 200)}`);
      return;
    }

    if (message.ok) {
      this.settle(message.id, null, message.result);
    } else {
      this.settle(message.id, new Error(message.error || 'yt-dlp failed'));
    }
  }

  private settle(id: number, error: Error | null, result?: unknown) {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    clearTimeout(entry.timer);
    if (error) entry.reject(error);
    else entry.resolve(result);
  }

  private rejectAll(error: Error) {
    for (const [id] of this.pending) {
      this.settle(id, error);
    }
  }
}

const worker = new YtDlpWorker();

export const stopYtDlpWorker = () => worker.stop();
export const isYtDlpWorkerRunning = () => worker.isRunning;

export const pingYtDlp = () => worker.request<{ pong: boolean; version: string }>({ op: 'ping' }, 15_000);

export const extractStream = async (videoId: string): Promise<StreamDescriptor> => {
  try {
    return await worker.request<StreamDescriptor>({ op: 'extract', videoId });
  } catch (error) {
    throw describeYtDlpError(error instanceof Error ? error.message : String(error));
  }
};

export const searchYouTube = async (query: string, limit = 10): Promise<MusicSearchResult[]> => {
  const results = await worker.request<MusicSearchResult[]>({ op: 'search', query, limit });
  return results.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
};
