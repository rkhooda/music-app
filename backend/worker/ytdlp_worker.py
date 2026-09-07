"""Long-lived yt-dlp worker.

Node spawns this once and talks JSON lines over stdin/stdout. Keeping yt-dlp
resident avoids ~1-2 s of interpreter start-up and challenge-solver warm-up per
extraction (measured: 2.2-4.9 s per CLI call vs 1.3-1.8 s in-process).

Request:  {"id": 1, "op": "extract", "videoId": "dQw4w9WgXcQ"}
          {"id": 2, "op": "search", "query": "coldplay yellow", "limit": 10}
Response: {"id": 1, "ok": true, "result": {...}}
          {"id": 1, "ok": false, "error": "..."}
"""

import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, urlparse

import yt_dlp

WORKERS = int(sys.argv[1]) if len(sys.argv) > 1 else 2
WATCH_URL = "https://www.youtube.com/watch?v={}"
FALLBACK_TTL_S = 30 * 60

_write_lock = threading.Lock()
_local = threading.local()


def _base_opts():
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        "socket_timeout": 10,
        "js_runtimes": {"node": {}},
        # Adaptive m4a (itag 140) is present in the player response; the HLS/DASH
        # manifests only add formats we never pick, so skip those round trips.
        "extractor_args": {"youtube": {"skip": ["hls", "dash"]}},
    }
    cookie_file = os.environ.get("YT_DLP_COOKIES_FILE", "").strip()
    cookie_browser = os.environ.get("YT_DLP_COOKIES_FROM_BROWSER", "").strip()
    if cookie_file:
        opts["cookiefile"] = cookie_file
    elif cookie_browser:
        opts["cookiesfrombrowser"] = (cookie_browser,)
    return opts


def _ydl(kind):
    """One YoutubeDL per thread and per kind; instances are not thread-safe."""
    cache = getattr(_local, "ydl", None)
    if cache is None:
        cache = _local.ydl = {}
    if kind not in cache:
        opts = _base_opts()
        if kind == "extract":
            opts["format"] = "bestaudio[ext=m4a]/bestaudio"
        else:
            opts["extract_flat"] = True
        cache[kind] = yt_dlp.YoutubeDL(opts)
    return cache[kind]


def _expires_at_ms(url):
    try:
        expire = parse_qs(urlparse(url).query).get("expire", [None])[0]
        value = int(expire) * 1000
        if value > time.time() * 1000:
            return value
    except (TypeError, ValueError):
        pass
    return int((time.time() + FALLBACK_TTL_S) * 1000)


def _extract(video_id):
    info = _ydl("extract").extract_info(WATCH_URL.format(video_id), download=False)
    url = info.get("url")
    if not url:
        raise RuntimeError("yt-dlp returned no stream URL")
    return {
        "url": url,
        "expiresAt": _expires_at_ms(url),
        "httpHeaders": info.get("http_headers") or {},
        "duration": info.get("duration"),
        "title": info.get("title"),
        "formatId": info.get("format_id"),
    }


def _thumbnail(entry):
    if entry.get("thumbnail"):
        return entry["thumbnail"]
    thumbs = entry.get("thumbnails") or []
    return thumbs[-1]["url"] if thumbs else None


def _search(query, limit):
    info = _ydl("search").extract_info(f"ytsearch{limit}:{query}", download=False)
    results = []
    for entry in info.get("entries") or []:
        if not entry or not entry.get("id"):
            continue
        results.append(
            {
                "id": entry["id"],
                "title": entry.get("title") or "Untitled",
                "artist": entry.get("uploader") or entry.get("channel") or "Unknown artist",
                "duration": entry.get("duration"),
                "thumbnail": _thumbnail(entry),
                "url": WATCH_URL.format(entry["id"]),
                "viewCount": entry.get("view_count") or 0,
            }
        )
    return results


def _respond(payload):
    line = json.dumps(payload, separators=(",", ":"))
    with _write_lock:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()


def _handle(request):
    rid = request.get("id")
    try:
        op = request.get("op")
        if op == "extract":
            result = _extract(request["videoId"])
        elif op == "search":
            result = _search(request["query"], int(request.get("limit") or 10))
        elif op == "ping":
            result = {"pong": True, "version": yt_dlp.version.__version__}
        else:
            raise ValueError(f"unknown op: {op}")
        _respond({"id": rid, "ok": True, "result": result})
    except Exception as error:  # noqa: BLE001 - every failure must reach Node
        message = str(error)
        if message.startswith("ERROR: "):
            message = message[7:]
        _respond({"id": rid, "ok": False, "error": message})


def main():
    pool = ThreadPoolExecutor(max_workers=WORKERS)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue
        pool.submit(_handle, request)
    pool.shutdown(wait=False, cancel_futures=True)


if __name__ == "__main__":
    main()
