# Music App

Personal Android music player: YouTube search, instant streaming through a
local backend, playlists, and offline downloads. Not intended for distribution.

```
frontend/   Expo (React Native) app — expo-audio player, Zustand stores, TanStack Query
backend/    Express + resident yt-dlp worker — search, stream cache, audio proxy
```

## How playback works

```
search ──▶ YouTube Data API (or yt-dlp fallback) ──▶ results in ~0.3 s
                                                        │
                                            backend warms top 3 (low priority)
tap ──▶ player.replace(/api/music/stream/:id)  +  GET /api/music/url/:id  (parallel)
                │                                        │
                └──── backend: cache hit → proxy googlevideo immediately
                                cache miss → one yt-dlp extraction (~1.5 s), deduped, play-priority
```

* One Python yt-dlp worker stays resident (`backend/worker/ytdlp_worker.py`);
  Node talks to it over JSON lines. Cold-start cost per extraction is gone.
* `videoId → stream URL` is cached in memory until YouTube's own expiry. Taps
  outrank "next track" which outranks speculative warming; identical requests
  share one extraction.
* The backend proxies audio because YouTube binds stream URLs to the IP that
  extracted them. A 403 from YouTube triggers one transparent re-extraction.
* The app keeps a single `expo-audio` player alive and swaps its source.

## Run it

Backend (macOS/Linux, needs Python 3 and Node 20+):

```bash
cd backend
npm install
npm run setup            # creates .venv with yt-dlp
cp .env.example .env     # add YOUTUBE_DATA_API_KEY for fast search
npm run dev              # http://0.0.0.0:3000
```

Frontend (Android device or emulator on the same Wi‑Fi):

```bash
cd frontend
npm install
npx expo run:android     # first time: builds the dev client
npx expo start           # afterwards
```

The app talks to the machine serving the Metro bundle on port 3000, so no IP
configuration is needed. See `frontend/.env.example` to override.

## Checks

```bash
cd backend && npm run typecheck && npm test     # smoke test: dedup, priority, expired-URL recovery
cd frontend && npm run typecheck
```

In development the Metro console prints `[perf] tap→audio …ms` per play, and
Settings shows the last measurement plus backend health and cache stats.

## API

| Route | Purpose |
|---|---|
| `GET /health` | yt-dlp status, search mode, cache stats |
| `GET /api/music/search?q=` | search results (24 h cache) |
| `GET /api/music/url/:videoId` | resolve + cache a stream (`{url, expiresAt, duration}`) |
| `GET /api/music/stream/:videoId` | audio proxy with Range support and expired-URL recovery |
| `POST /api/music/prefetch` | `{ids: string[], priority: 'next' \| 'warm'}` — returns 202 immediately |

## Known limits

* Downloads run only while the app is open (no Android foreground service for
  file transfers in this Expo setup); interrupted downloads resume on next launch.
* Lock-screen controls expose play/pause and seek; expo-audio's Android media
  session does not forward next/previous.
* Search falls back to yt-dlp (~1.5–3 s) when no YouTube Data API key is set.
