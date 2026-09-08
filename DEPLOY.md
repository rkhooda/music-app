# Running the backend on an old Android phone

Goal: the laptop stays off. An old phone on a charger runs the backend 24/7 at
home, and your main phone reaches it from anywhere through Tailscale. Everything
below is free.

Why a phone and not a free cloud VM: YouTube blocks yt-dlp from datacenter IPs
("Sign in to confirm you're not a bot"). A phone on home Wi‑Fi has a normal
residential IP and behaves exactly like the laptop did.

## 1. Old phone: Termux + backend (15 minutes)

1. Install **Termux** from F-Droid (not the Play Store build, it is abandoned).
   Also install **Termux:Boot** from F-Droid and open it once.
2. Android Settings → Apps → Termux → Battery → *Unrestricted*. On Android 12+
   also disable "phantom process" killing once, from the laptop with the phone
   plugged in and USB debugging on:
   ```bash
   adb shell "settings put global settings_enable_monitor_phantom_procs false"
   ```
   (Without this, Android may kill the yt-dlp worker after a while.)
3. In Termux:
   ```bash
   pkg install -y git
   git clone https://github.com/rkhooda/music-app
   cd music-app
   bash backend/scripts/termux-setup.sh
   nano backend/.env          # paste YOUTUBE_DATA_API_KEY
   bash backend/scripts/termux-run.sh
   ```
   The run script holds a wake lock, restarts the server if it crashes, and
   updates yt-dlp daily. It is also registered with Termux:Boot, so a reboot
   brings the backend back by itself.
4. Check from the old phone's browser: `http://localhost:3000/health` → `"status":"ok"`.

Keep the screen off; the wake lock keeps the CPU running. Expect a few percent
battery drain per hour while plugged in, which the charger covers.

## 2. Reach it from anywhere: Tailscale (5 minutes)

1. Install **Tailscale** from the Play Store on both phones and sign in with the
   same account (free personal plan).
2. On the old phone, the Tailscale app shows its address, e.g. `100.64.1.2`.
   Tailscale exposes local ports, so the backend is now at `http://100.64.1.2:3000`
   from any device on your tailnet, on any network.
3. At home you can also use the old phone's Wi‑Fi address (`192.168.x.x:3000`),
   but the Tailscale address works everywhere, so just use that.

## 3. Main phone: point the app at it

Open the app → **Settings → Backend → Address** and type `100.64.1.2:3000`.
The status dot turns green when reachable. This is saved on the phone, so no
rebuild is needed when the address changes, and clearing the field returns to
auto-detect for development with `npx expo start`.

## 4. Build the app once so Metro is not needed

Either:

- **EAS (free tier):** `cd frontend && npx eas build -p android --profile preview`
  → download the APK link on your phone and install it.
- **Locally with Android Studio installed:** `npx expo run:android --variant release`
  with the phone connected over USB.

Both produce a standalone APK; the backend address entered in Settings is used.

## Updating later

On the old phone: `cd music-app && git pull && bash backend/scripts/termux-setup.sh`
then restart the run script (Ctrl+C, run again, or reboot).

## If songs stop playing

Nine times out of ten YouTube changed something and yt-dlp needs an update.
The run script updates it daily; to force it: `cd music-app/backend &&
.venv/bin/pip install -U yt-dlp` and restart. Settings → Backend shows the
yt-dlp version the backend is using.
