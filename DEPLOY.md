# DEPLOY.md — Windows deploy runbook

This is for the **Windows deploy agent**. You deploy two things from this PC:

1. the **Pi API** (FastAPI) onto the Raspberry Pi, exposed via Cloudflare Tunnel
2. the **frontend** (Next.js) onto Vercel

You only deploy. Do not change code or make design decisions. Run the blocks in
order, top to bottom. Everything below the fill-in table is literal once you've
filled the table in.

**Requirements on this PC** (all standard on Windows 10/11):
- OpenSSH client (`ssh`, `scp`) — preinstalled; verify with `ssh -V`
- Node.js 18+ and `npm` — verify with `node -v`
- PowerShell 5+ (the default terminal)
- This repository, already cloned, and this is your working directory

---

## STEP 0 — FILL THESE IN FIRST

Edit the values, then paste this whole block into PowerShell. Every later
command reuses these variables. Do not put a trailing slash on URLs.

```powershell
# --- Pi ---
$PI            = "rmostag1@simurgh.local"   # SSH target for the Raspberry Pi
$PI_HOME       = "/home/rmostag1"           # the Pi user's home directory

# --- Public hostnames ---
$API_HOSTNAME  = "api.birds.example.com"    # Cloudflare Tunnel hostname for the API
$VERCEL_DOMAIN = "birds.example.com"         # public site domain (the frontend)

# --- Derived (leave as-is) ---
$ALLOWED_ORIGINS = "https://$VERCEL_DOMAIN"
$API_BASE_URL    = "https://$API_HOSTNAME"
$REPO            = (Get-Location).Path

# --- Frontend cosmetic header text ---
$SITE_NAME     = "Garden Birds"
$SITE_LOCATION = "Utrecht, NL"

# --- Filled in during the steps below (set when instructed) ---
$SPECIES_DATA_URL = ""   # set after the first image-gen run (STEP 5); empty is fine at first
```

Sanity check the tools:

```powershell
ssh -V; node -v; npm -v
```

---

## STEP 1 — HUMAN STEPS (cannot be automated)

These need a browser or a secret. Do these yourself (or hand to the human), then
continue. Keep secrets out of the repo and out of chat.

1. **Buy / configure the domain** `$VERCEL_DOMAIN`. Its DNS must be manageable
   (Cloudflare is assumed, since you're using a Cloudflare Tunnel).
2. **Cloudflare Tunnel login** (browser): in STEP 3 you'll run
   `cloudflared tunnel login` on the Pi — it prints a URL you must open in a
   browser and authorize. That's the only interactive part of the Pi deploy.
3. **Vercel account + login**: STEP 4 runs `vercel login` (opens a browser).
4. **Vercel Blob store** (only needed for species images, STEP 5): in the Vercel
   dashboard → Storage → create a Blob store. Copy its
   `BLOB_READ_WRITE_TOKEN`. You'll paste it into a terminal, never into a file.
5. **API keys**: none required for the default setup. (OpenAI image generation
   is an optional future stub — not part of this deploy.)

Everything else below is scripted.

---

## STEP 2 — Deploy the Pi API

Copies `apps/pi-api` to the Pi, builds a venv, writes `.env`, installs and
starts the systemd service. Run from the repo root.

```powershell
# 2a. Copy the API to the Pi (creates ~/birdnet-public/apps/pi-api)
ssh $PI "mkdir -p ~/birdnet-public/apps"
scp -r "$REPO\apps\pi-api" "${PI}:~/birdnet-public/apps/"
```

```powershell
# 2b. Write the Pi API .env (CORS locked to your Vercel domain)
$envFile = @"
BIRDS_DB_PATH=$PI_HOME/BirdNET-Pi/scripts/birds.db
BIRDSONGS_DIR=$PI_HOME/BirdNET-Pi/BirdSongs/Extracted/By_Date
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
API_HOST=127.0.0.1
API_PORT=8000
"@
$envFile | ssh $PI "cat > ~/birdnet-public/apps/pi-api/.env"
```

```powershell
# 2c. Create the Python venv and install dependencies on the Pi
ssh $PI @'
set -e
cd ~/birdnet-public/apps/pi-api
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
echo "venv ready"
'@
```

```powershell
# 2d. Install + start the systemd service
ssh $PI @'
set -e
sudo cp ~/birdnet-public/apps/pi-api/deploy/birdnet-api.service /etc/systemd/system/birdnet-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now birdnet-api
sleep 2
systemctl --no-pager --full status birdnet-api | head -n 12
'@
```

```powershell
# 2e. Verify the API is up locally on the Pi
ssh $PI "curl -s http://127.0.0.1:8000/health && echo"
```

Expected: `{"status":"ok"}`. If the `detections` table is still empty, data
endpoints return `[]` — that is correct until birds are detected.

---

## STEP 3 — Expose the API via Cloudflare Tunnel (on the Pi)

```powershell
# 3a. Install cloudflared on the Pi (arm64)
ssh $PI @'
set -e
ARCH=$(dpkg --print-architecture)
curl -fsSL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb
sudo dpkg -i /tmp/cloudflared.deb
cloudflared --version
'@
```

```powershell
# 3b. HUMAN: browser login. This prints a URL — open it and authorize the
#     domain. It writes ~/.cloudflared/cert.pem on the Pi.
ssh $PI "cloudflared tunnel login"
```

```powershell
# 3c. Create the tunnel, write its config from the template, route DNS, and
#     install it as a service. Derives the tunnel UUID automatically.
ssh $PI @"
set -e
cloudflared tunnel create birdnet || true
TUNNEL_ID=`$(basename `$(ls ~/.cloudflared/*.json | grep -v cert | head -n1) .json)
echo "tunnel id: `$TUNNEL_ID"
sed -e "s|<TUNNEL_UUID>|`$TUNNEL_ID|g" -e "s|<API_PUBLIC_HOSTNAME>|$API_HOSTNAME|g" \
  ~/birdnet-public/apps/pi-api/deploy/cloudflared-config.yml > ~/.cloudflared/config.yml
cat ~/.cloudflared/config.yml
cloudflared tunnel route dns birdnet $API_HOSTNAME
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sleep 3
systemctl --no-pager status cloudflared | head -n 8
"@
```

```powershell
# 3d. Verify the API is reachable on the public hostname (from this PC)
curl.exe -s "$API_BASE_URL/health"
```

Expected: `{"status":"ok"}`. If this fails, wait ~30s for DNS/tunnel to settle
and retry; do not change anything.

---

## STEP 4 — Deploy the frontend to Vercel

```powershell
# 4a. Install the Vercel CLI and log in (browser)
npm i -g vercel
vercel login
```

```powershell
# 4b. Link the project (root directory = apps/web)
cd "$REPO\apps\web"
vercel link --yes
```

```powershell
# 4c. Set production environment variables (non-interactive)
"$API_BASE_URL"     | vercel env add BIRD_API_URL production
"$SITE_NAME"        | vercel env add NEXT_PUBLIC_SITE_NAME production
"$SITE_LOCATION"    | vercel env add NEXT_PUBLIC_SITE_LOCATION production
# Leave SPECIES_DATA_URL unset for now (the site uses fallbacks). You'll add it
# in STEP 5 if/when you publish species images.
```

```powershell
# 4d. Deploy to production and capture the deployment URL
$DEPLOY_URL = (vercel --prod) | Select-Object -Last 1
$DEPLOY_URL
cd $REPO
```

```powershell
# 4e. Attach the custom domain to this deployment
vercel domains add $VERCEL_DOMAIN
vercel alias set $DEPLOY_URL $VERCEL_DOMAIN
```

**DNS for the custom domain:** Vercel will display the exact records to add.
Typically, in Cloudflare DNS for `$VERCEL_DOMAIN`:
- an `A` record `@ → 76.76.21.21`, or
- a `CNAME` `www → cname.vercel-dns.com`

Add whatever Vercel's dashboard/CLI tells you. (The `$API_HOSTNAME` record was
created automatically by `cloudflared tunnel route dns` in STEP 3 — leave it.)

```powershell
# 4f. Verify the live site renders
curl.exe -s "https://$VERCEL_DOMAIN" | Select-String "$SITE_NAME"
```

---

## STEP 5 — (One-time) Species text enrichment

Per-species text (a one-line Wikipedia description + Wikidata genus) is produced
by a scheduled **GitHub Action** (`.github/workflows/enrich.yml`) that writes
`species.json` to Vercel Blob. The frontend reads it at runtime, so new species
get text with **no redeploy**. This is browser/console setup, not a script:

1. **Create a Vercel Blob store** — Vercel → Storage → Create → Blob → connect it
   to the project. Copy its `BLOB_READ_WRITE_TOKEN`.
2. **Add GitHub Action secrets** — repo → Settings → Secrets and variables →
   Actions: `BLOB_READ_WRITE_TOKEN`, and `BIRD_API_URL` (= `$API_BASE_URL`).
3. **Run it once** — repo → Actions → "Enrich species text" → Run workflow. The
   log prints `species.json -> https://<store>.public.blob.vercel-storage.com/species.json`.
4. **Set `SPECIES_DATA_URL`** to that URL in Vercel (Settings → Environment
   Variables → Production) and add it as a GitHub Action secret too (for
   idempotency). Redeploy once so Vercel picks up the new env var.

After this, the Action runs hourly and new species are enriched automatically.

> Species **images** are handled separately by the cutout pipeline (committed to
> the repo, auto-deployed) — not by this step.

---

## What was verified before handoff (on the build machine) vs. post-deploy

**Verified on the Mac (build-time):**
- Pi API runs and every endpoint returns correct data against a synthetic DB
  (detections ordering, life list, species detail/genus, top-species,
  first-detections, histogram bucketing, audio streaming with `audio/mpeg` +
  immutable cache, 400 on bad window, 404 on missing clip, CORS restricted to
  the allowed origin, short cache TTL on JSON).
- Frontend: `typecheck`, `lint`, and production `build` all clean; all three
  views (collage / stats / atlas), the time-window selector, the sort controls,
  and the species detail modal render and work against mock data.
- image-gen: typechecks; dry-run enriches species from Wikipedia, picks up
  provided images, writes `species.json`, and is idempotent on re-run.

**Can only be confirmed AFTER deploy (do these as you go):**
- Live Cloudflare Tunnel connectivity (STEP 3d).
- Real detections rendering once BirdNET-Pi has logged some (the DB is empty at
  first — empty endpoints are expected, not a bug).
- Audio clip playback end-to-end (clips don't exist until detections occur; the
  resolver tries `By_Date/{Date}/{Com_Name}/{File_Name}` then falls back to a
  recursive search — confirm a clip plays once data exists).
- Vercel custom-domain DNS propagation (STEP 4f).
