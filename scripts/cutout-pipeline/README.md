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

Use this exact prompt with Nano Banana, swapping the species name:

```
A single <Common Name>, side profile, illustrated in a loose hand-drawn
ink-and-watercolor field guide style — soft pencil contours, gentle watercolor
washes, slightly imperfect lines, naturalistic but stylized. Accurate,
field-guide-correct plumage and bare-part colours for the species. Full body,
facing right. Subject only — solid white background, no shadow, no ground, no
perch. No text, no caption, no species label, no lettering, no watermark, no
border or frame anywhere in the image.
```

rembg keys out the white background reliably.

### On the old `<key identifying features>` slot

Earlier revisions had a parenthetical after the common name. It was meant to be
hand-written field marks, but the automation auto-filled it with `enrich.ts`'s
`wikiSummary` — the *first sentence of the Wikipedia article*, which is
taxonomy, not appearance:

> Forster's tern is a tern in the family Laridae.

That gave the model no plumage information (it invented a rufous cap on a bird
that has a black one) and restated the species name mid-prompt, which nudged it
toward captioning. The common name alone is the stronger signal — the model
already knows these birds — so the slot is gone, replaced by an explicit
accuracy clause. If you want per-species control, hand-write real field marks;
do not wire in generic summary text.

Both negative clauses are load-bearing:

- **Solid white background** is what rembg keys against.
- **No text** — "field guide style" pulls the model toward plate captions. Left
  unsaid, it drew a "Forster's Tern / Sterna forsteri" label beneath the bird.
  Lettering is opaque, so rembg preserves it, it falls inside the alpha bbox,
  and the collage then sizes and packs the bird by a box that is largely text.

This prompt is duplicated in `scripts/image-gen/src/images.ts` (`buildPrompt`),
which is what the `Generate bird cutouts` workflow actually calls. Change both.
