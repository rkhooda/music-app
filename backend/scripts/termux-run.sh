#!/data/data/com.termux/files/usr/bin/bash
# Keeps the backend running on a phone: holds a wake lock, restarts on crash,
# and updates yt-dlp once a day (YouTube changes often; stale yt-dlp = failed extraction).
cd "$(dirname "$0")/.."
termux-wake-lock 2>/dev/null || true

LAST_UPDATE=0
while true; do
  NOW=$(date +%s)
  if [ $((NOW - LAST_UPDATE)) -gt 86400 ]; then
    .venv/bin/pip install --quiet --upgrade yt-dlp 2>/dev/null && echo "yt-dlp updated $(date)"
    LAST_UPDATE=$NOW
  fi
  echo "starting backend $(date)"
  node dist/server.js
  echo "backend exited with $? — restarting in 3s"
  sleep 3
done
