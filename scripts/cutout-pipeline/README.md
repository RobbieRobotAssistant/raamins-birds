# Cutout pipeline

Turns a Nano Banana illustration → tight transparent PNG + low-res mask + manifest entry.

## What it produces

For each species:
- `apps/web/public/birds/<slug>.png` — transparent cutout, long-edge ≤ 560px
- `apps/web/lib/cutouts.manifest.json` — merged manifest (one entry per species)
- `apps/web/lib/cutouts.generated.ts` — TS module the collage imports

## One-time setup

Background-removal venv lives at `~/.openclaw/workspace/working-files/bg-remove/.venv`.
First run downloads the u2net model (~176MB) into `~/.u2net/`.

```bash
mkdir -p ~/.openclaw/workspace/working-files/bg-remove
cd ~/.openclaw/workspace/working-files/bg-remove
python3 -m venv .venv
.venv/bin/pip install rembg onnxruntime pillow
```

## Process one species

```bash
~/.openclaw/workspace/working-files/bg-remove/.venv/bin/python \
  scripts/cutout-pipeline/process_cutout.py \
  --raw /path/to/raw.jpg \
  --slug cardinalis-cardinalis \
  --com-name "Northern Cardinal" \
  --web-dir apps/web
```

Slug convention: scientific name, lowercased, spaces → hyphens.
`Cardinalis cardinalis` → `cardinalis-cardinalis`.

The script is idempotent — re-running for the same slug overwrites cleanly.

## Style prompt (locked)

Use this exact prompt with Nano Banana, swapping the species line:

```
A single <Common Name> (<key identifying features>), side profile, illustrated
in a loose hand-drawn ink-and-watercolor field guide style — soft pencil
contours, gentle watercolor washes, slightly imperfect lines, naturalistic but
stylized. Full body, facing right. Subject only — solid white background, no
shadow, no ground, no perch.
```

rembg keys out the white background reliably.
