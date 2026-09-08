#!/data/data/com.termux/files/usr/bin/bash
# One-time setup of the backend inside Termux (F-Droid build) on an Android phone.
# Run from the repo root:  bash backend/scripts/termux-setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing packages (node, python, git, tailscale-free bits)"
pkg update -y
pkg install -y nodejs-lts python git termux-api

echo "==> Installing Node dependencies and building"
npm ci
npm run build

echo "==> Creating Python venv with yt-dlp"
python -m venv .venv
.venv/bin/pip install --quiet --upgrade pip yt-dlp

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' .env
  echo "==> Wrote backend/.env — add your YOUTUBE_DATA_API_KEY to it (nano .env)"
fi

mkdir -p ~/.termux/boot
cat > ~/.termux/boot/music-backend.sh <<EOF
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
cd "$(pwd)" && bash scripts/termux-run.sh >> ~/music-backend.log 2>&1 &
EOF
chmod +x ~/.termux/boot/music-backend.sh

echo
echo "Done. Start now with:   bash backend/scripts/termux-run.sh"
echo "Auto-start on boot needs the Termux:Boot app (F-Droid) opened once."
