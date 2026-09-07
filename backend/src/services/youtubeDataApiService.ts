import { config } from '../config';
import { MusicSearchResult } from './musicTypes';

export class YouTubeDataApiError extends Error {
  constructor(
    message: string,
    readonly shouldFallbackToYtDlp: boolean,
  ) {
    super(message);
    this.name = 'YouTubeDataApiError';
  }
}

interface ApiError {
  error?: {
    errors?: Array<{ reason?: string; message?: string }>;
    message?: string;
  };
}

interface ThumbnailSet {
  high?: { url?: string };
  medium?: { url?: string };
  default?: { url?: string };
}

interface SearchApiResponse extends ApiError {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string; thumbnails?: ThumbnailSet };
  }>;
}

interface VideosApiResponse extends ApiError {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
  }>;
}

const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const FALLBACK_REASONS = new Set(['accessNotConfigured', 'dailyLimitExceeded', 'keyExpired', 'keyInvalid', 'quotaExceeded']);
const REQUEST_TIMEOUT_MS = 8_000;

export const isYouTubeDataApiConfigured = () => Boolean(config.youtubeApiKey);

const parseDuration = (duration?: string): number | null => {
  const parts = duration?.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!parts) return null;
  return Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0);
};

const decodeHtml = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const callApi = async <T extends ApiError>(endpoint: string, params: Record<string, string>, label: string): Promise<T> => {
  const url = `${endpoint}?${new URLSearchParams({ ...params, key: config.youtubeApiKey }).toString()}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const payload = (await response.json()) as T;

  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason || '';
    const message = payload.error?.errors?.[0]?.message || payload.error?.message || `YouTube Data API ${label} failed`;
    const fallback = [400, 401, 403].includes(response.status) || FALLBACK_REASONS.has(reason);
    throw new YouTubeDataApiError(message, fallback);
  }

  return payload;
};

export const searchYouTubeWithDataApi = async (query: string, maxResults = 10): Promise<MusicSearchResult[]> => {
  if (!isYouTubeDataApiConfigured()) {
    throw new YouTubeDataApiError('YOUTUBE_DATA_API_KEY is not configured', true);
  }

  const search = await callApi<SearchApiResponse>(
    SEARCH_ENDPOINT,
    { part: 'snippet', type: 'video', videoCategoryId: '10', maxResults: String(maxResults), q: query },
    'search',
  );

  const items = (search.items || []).filter((item) => item.id?.videoId);
  if (items.length === 0) return [];

  const videos = await callApi<VideosApiResponse>(
    VIDEOS_ENDPOINT,
    { part: 'contentDetails,statistics', id: items.map((item) => item.id!.videoId!).join(',') },
    'videos',
  );

  const metadata = new Map(
    (videos.items || [])
      .filter((item) => item.id)
      .map((item) => [item.id!, { duration: parseDuration(item.contentDetails?.duration), viewCount: Number(item.statistics?.viewCount || 0) }]),
  );

  return items
    .map((item): MusicSearchResult => {
      const videoId = item.id!.videoId!;
      const meta = metadata.get(videoId);
      const thumbs = item.snippet?.thumbnails;
      return {
        id: videoId,
        title: decodeHtml(item.snippet?.title || 'Untitled'),
        artist: decodeHtml(item.snippet?.channelTitle || 'Unknown artist'),
        duration: meta?.duration ?? null,
        thumbnail: thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        viewCount: meta?.viewCount || 0,
      };
    })
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
};
