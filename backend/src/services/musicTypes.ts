export interface MusicSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number | null;
  thumbnail?: string;
  url?: string;
  viewCount?: number;
}

export interface StreamDescriptor {
  url: string;
  httpHeaders: Record<string, string>;
  /** Epoch ms parsed from the googlevideo `expire` param. */
  expiresAt: number;
  duration?: number | null;
  title?: string | null;
  formatId?: string;
}

/** play = user tapped it, next = queued to play soon, warm = speculative. */
export type StreamPriority = 'play' | 'next' | 'warm';
