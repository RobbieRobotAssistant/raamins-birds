# Raamin's Birds

A Next.js web application for tracking bird species detected by a BirdNET-Pi listening station. Displays detections in real-time with species illustrations and interactive visualizations.

## Live Site

**URL:** https://raamins-birds.vercel.app

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel (Next.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Atlas      │  │   Collage    │  │    Stats / Details   │ │
│  │  Life list   │  │  Spiral viz  │  │    Species pages     │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│                            │                                     │
│                   ┌────────▼────────┐                          │
│                   │  FastAPI Cache  │                          │
│                   │   (SQLite)      │                          │
│                   └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **API:** Python FastAPI + SQLite (BirdNET-Pi database)
- **Hosting:** Vercel (auto-deploys from GitHub)
- **Database:** SQLite with BirdNET-Pi detections table

## Key Features

### Atlas View
- Full life list sorted by detection count
- Species illustrations (cutout PNGs with transparent backgrounds)
- Click to view species details

### Collage View
- Spiral-packing algorithm for non-overlapping bird placement
- Scale based on detection frequency
- Responsive: adapts from mobile to desktop
- Time window filtering (1H, 12H, 24H, All)

### Species Modal
- Full species details with detection history
- Audio clip playback (when available)
- Backdrop blur transitions

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript |
| Styling | Tailwind CSS |
| API | FastAPI (Python) |
| Database | SQLite |
| Hosting | Vercel |
| Images | Custom cutout pipeline (rembg + PIL) |

## Cutout Pipeline

Species illustrations are processed through a custom pipeline:

1. **Generate** - AI image generation (field-guide watercolor style)
2. **Remove background** - rembg for transparent cutouts
3. **Resize** - Long-edge 560px
4. **Mask generation** - 28-grid binary mask for spiral packing
5. **Deploy** - Committed to repo, auto-deploys to Vercel

```bash
# Run discovery to find new species
cd scripts/bird-cutout && ./auto-cutout.sh

# Generate images, then process
./process-pending.sh
```

## Project Structure

```
Bird/
├── apps/
│   ├── pi-api/              # FastAPI backend
│   │   └── app/routers/    # API endpoints
│   └── web/                 # Next.js frontend
│       ├── components/     # React components
│       ├── lib/             # Utilities, cutout manifests
│       └── public/birds/    # Species cutout images
├── scripts/
│   ├── cutout-pipeline/     # Image processing pipeline
│   └── bird-cutout/         # Automation skill
└── ...
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/detections` | Recent detections by time window |
| `GET /api/species` | Life list with counts |
| `GET /api/species/:sci_name` | Species details |
| `GET /api/stats/top-species` | Most detected species |
| `GET /api/recordings/:rowid` | Audio clip streaming |

## Development

```bash
# Frontend (with mock data)
cd apps/web && npm run dev

# API (requires birds.db)
cd apps/pi-api && python -m uvicorn app.main:app --reload
```

## Species Illustrations

All species illustrations are stored as transparent PNG cutouts in `apps/web/public/birds/`. The manifest in `apps/web/lib/cutouts.generated.ts` controls which species display in the collage visualization.

To add a new species illustration:
1. Run discovery: `./auto-cutout.sh`
2. Generate image with field-guide prompt
3. Run processing: `./process-pending.sh`

## Design Choices

### Collage Visualization
- Uses spiral-packing algorithm to avoid overlapping birds
- Bird size scales with detection frequency
- Time-windowed filtering (1H/12H/24H/ALL)
- Mobile-responsive scaling

### Atlas Display
- Clean, typographic field-guide aesthetic
- Species name in italics (scientific name)
- Detection count and timestamp
- Transparent cutout images where available

### Cutout Style
- Ink-and-watercolor field guide illustration
- Dark ink on off-white background
- Transparent backgrounds for overlay composition
- 28-grid mask for collision detection in collage