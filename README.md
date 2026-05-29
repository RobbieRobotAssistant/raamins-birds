# BirdNET-Pi Public Site

A polished public website for a self-hosted [BirdNET-Pi](https://github.com/Nachtzuster/BirdNET-Pi)
listening station. BirdNET-Pi (running on a Raspberry Pi 5 with a USB mic) does
all the audio capture and species inference. **This repo is everything on top**:
a read-only API that exposes BirdNET-Pi's data, and a public Next.js frontend
that renders it.

Visual style is deliberately spare and typographic — dark ink on off-white,
field-notes labels, restrained.

## Architecture

```
 visitors ──► Vercel (Next.js) ──► /api/* route handlers ──► Cloudflare Tunnel ──► Pi (FastAPI) ──► birds.db (read-only)
                  │                      (Next data cache, ~60s)                                      BirdSongs/ (clips)
                  └─► species.json + images (Vercel Blob)  ◄── image-gen script (offline)
```

- **The Pi is never exposed directly.** Visitors only ever hit same-origin
  Next route handlers. Those call the Pi through a Cloudflare Tunnel and cache
  responses in the Next data cache (~60s), so the Pi sees at most ~1 request per
  endpoint per minute regardless of traffic. Audio clips are proxied + cached
  the same way.
- **Enrichment is offline.** Wikipedia summaries, genus, links, and image URLs
  are precomputed into `species.json` on Vercel Blob; the frontend just reads it.

## Repo layout (monorepo)

| Path | What | Runtime |
| --- | --- | --- |
| `apps/pi-api/` | FastAPI, read-only access to `birds.db` + clips | Python 3.11 on the Pi |
| `apps/web/` | Next.js App Router public site | Vercel |
| `scripts/image-gen/` | Offline species enrichment + image pipeline | Node, manual / cron |
| `DEPLOY.md` | Turnkey Windows (PowerShell) deploy runbook | — |

## The BirdNET-Pi database

A single flat `detections` table — no species table, no recording id. Key
consequences baked into the API:

- **Detection id = SQLite `rowid`** (there is no other identifier).
- `Date` and `Time` are separate columns; combined as `Date || ' ' || Time`.
- "Species" = distinct `Sci_Name`; all life-list/stats endpoints `GROUP BY Sci_Name`.
- Audio resolves from `File_Name` under `BirdSongs/Extracted/By_Date/`.
- **Read-only.** The API opens the DB with `mode=ro` and never writes.

## Pi API endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/detections?window=1h\|12h\|24h\|7d\|all` | recent detections |
| `GET /api/species?sort=count\|recent\|alpha` | life list |
| `GET /api/species/{sci_name}?window=…` | species detail (counts, recent clips) |
| `GET /api/recordings/{rowid}` | stream that detection's audio clip |
| `GET /api/stats/top-species?window=…` | most-heard in window |
| `GET /api/stats/first-detections` | newest life-list additions |
| `GET /api/stats/by-period?window=…` | histogram buckets |
| `GET /api/species-list` | distinct species (for image-gen) |
| `GET /health` | liveness |

CORS is restricted to the configured Vercel origin(s). JSON gets a short
shared-cache TTL; clips are cached `immutable`.

## Environment variables

**Pi API** (`apps/pi-api/.env`, see `.env.example`)

| Var | Meaning |
| --- | --- |
| `BIRDS_DB_PATH` | path to `birds.db` (read-only) |
| `BIRDSONGS_DIR` | path to `By_Date/` clips |
| `ALLOWED_ORIGINS` | comma-separated Vercel origins for CORS |
| `API_HOST` / `API_PORT` | bind address (cloudflared targets this) |

**Web** (`apps/web/.env.local`, see `.env.local.example`)

| Var | Meaning |
| --- | --- |
| `BIRD_API_URL` | Pi tunnel base URL. **Empty ⇒ mock mode.** |
| `SPECIES_DATA_URL` | public URL of `species.json` on Blob (empty ⇒ fallbacks) |
| `USE_MOCKS` | `1` forces mock mode even with `BIRD_API_URL` set |
| `NEXT_PUBLIC_SITE_NAME` / `NEXT_PUBLIC_SITE_LOCATION` | header text |

**image-gen** (`scripts/image-gen/.env`, see `.env.example`)

| Var | Meaning |
| --- | --- |
| `BIRD_API_URL` | Pi tunnel base (to list species) |
| `SPECIES_DATA_URL` | existing `species.json` URL (idempotency) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob write token |
| `IMAGE_PROVIDER` | `none` (default) or `openai` (stub) |
| `MAX_GENERATIONS` | per-run cap on AI generations |

## Local development

```bash
# Frontend on built-in mocks (no Pi needed) — leave BIRD_API_URL empty
cd apps/web && npm install && npm run dev      # http://localhost:3000

# Pi API against a synthetic DB
cd apps/pi-api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/seed_mock_db.py --clips
BIRDS_DB_PATH=scripts/mock-birds.db BIRDSONGS_DIR=scripts/mock-songs \
  ALLOWED_ORIGINS=http://localhost:3000 .venv/bin/python -m app.main

# Enrichment dry-run (writes ./out/species.json, no Blob)
cd scripts/image-gen && npm install && BIRD_API_URL=http://localhost:8000 npm run generate -- --dry-run
```

## Species illustrations

The image-gen script is **idempotent** and runs offline. Default `IMAGE_PROVIDER=none`
uploads no images — species without an illustration render a **common-name text
placeholder** in the UI, which is your signal to add a real one. To supply an
image, drop `scripts/image-gen/provided-images/<scientific-name-with-hyphens>.jpg`
and re-run; it uploads to Blob and records the mapping. AI generation via OpenAI
Images is wired as a documented stub (`src/providers.ts`) for later. AI images
are labelled "AI illustration" in the UI.

## Deployment

See **[DEPLOY.md](DEPLOY.md)** — a decision-free, PowerShell-native runbook for
deploying both components from a Windows PC.
