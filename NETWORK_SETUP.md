# Network setup & troubleshooting

## Default behaviour

The app derives the backend address from the Metro dev server: whichever
machine serves the JS bundle is assumed to run the backend on port 3000. On a
phone connected over Wi‑Fi this "just works"; nothing needs to be edited when
your laptop's IP changes.

Override only if needed, in `frontend/.env`:

```
EXPO_PUBLIC_API_PORT=3000                 # backend on a different port
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000   # backend on another machine
```

`localhost` in `EXPO_PUBLIC_API_URL` is replaced by the Metro host automatically
when running on a device.

## Verify

1. Backend: `cd backend && npm run dev` → `Listening on http://0.0.0.0:3000` and
   `yt-dlp <version> ready`. If it prints `yt-dlp worker unavailable`, run
   `npm run setup`.
2. From the laptop: `curl localhost:3000/health` → `"status":"ok"`.
3. From the phone's browser: `http://<laptop-ip>:3000/health` (find the IP with
   `ipconfig getifaddr en0` on macOS).
4. In the app, **Settings → Backend** shows the resolved address, reachability,
   yt-dlp version and search mode. Tap **Check again** after fixing anything.

## Common problems

| Symptom | Cause / fix |
|---|---|
| Settings shows *Unreachable* | Backend not running, or phone on a different network. macOS firewall: allow incoming connections for Node. |
| Search works but songs never start | Backend can reach YouTube for search but not for extraction → check backend log for `extract failed …`. |
| `YouTube blocked extraction` | Set `YT_DLP_COOKIES_FROM_BROWSER=chrome` (or `YT_DLP_COOKIES_FILE`) in `backend/.env`. |
| `yt-dlp not ready` in Settings | `cd backend && npm run setup`, then restart the backend. |
| Search takes 2–3 s | No `YOUTUBE_DATA_API_KEY` in `backend/.env`; the yt-dlp fallback is being used. |
| Android emulator | Works with the default (Metro host = 10.0.2.2 alias is applied when no host is detected). |
