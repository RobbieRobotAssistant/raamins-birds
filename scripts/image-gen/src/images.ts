import { promises as fs } from "node:fs";
import path from "node:path";

import { fetchSpeciesList } from "./api.js";
import { loadConfig } from "./config.js";
import { generateImage, resolveImageModel } from "./gemini.js";
import type { EnrichmentMap } from "./types.js";

// Finds species that BirdNET has detected but that have no collage cutout yet,
// generates an illustration for each with Gemini, and writes the raw files to
// out/raw/ plus an out/pending.json worklist. A later workflow step feeds that
// list to scripts/cutout-pipeline/process_cutout.py, which does background
// removal, mask generation and manifest merging.
//
// This replaces the external polling bot. Idempotent: species that already
// have a cutout are skipped, so a scheduled run normally does nothing.

const OUT_DIR = "out";
const RAW_DIR = path.join(OUT_DIR, "raw");
const PENDING = path.join(OUT_DIR, "pending.json");

// Bounded per run so one bad day can't fire hundreds of paid image calls.
const DEFAULT_MAX_PER_RUN = 4;

interface PendingItem {
  slug: string;
  comName: string;
  sciName: string;
  raw: string;
}

/** Slug convention, identical to CollageView.sciToSlug — keep in lockstep. */
function sciToSlug(sci: string): string {
  return sci.toLowerCase().trim().replace(/\s+/g, "-");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Slugs already present in the cutout manifest the collage reads. */
async function existingCutouts(webDir: string): Promise<Set<string>> {
  const manifestPath = path.join(webDir, "lib", "cutouts.manifest.json");
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    return new Set(Object.keys(JSON.parse(raw)));
  } catch {
    return new Set();
  }
}

/** Optional descriptive text, reused from the text-enrichment species.json. */
async function loadFeatures(url: string): Promise<EnrichmentMap> {
  if (!url) return {};
  try {
    const r = await fetch(`${url}?t=${Date.now()}`);
    if (r.ok) return (await r.json()) as EnrichmentMap;
  } catch {
    /* non-fatal: prompts just lose the extra detail */
  }
  return {};
}

/**
 * The locked field-guide style prompt from scripts/cutout-pipeline/README.md.
 * The solid white background is what lets rembg key the subject out cleanly,
 * so do not loosen that clause.
 */
function buildPrompt(comName: string, features: string): string {
  return (
    `A single ${comName} (${features}), side profile, illustrated in a loose ` +
    `hand-drawn ink-and-watercolor field guide style — soft pencil contours, ` +
    `gentle watercolor washes, slightly imperfect lines, naturalistic but ` +
    `stylized. Full body, facing right. Subject only — solid white background, ` +
    `no shadow, no ground, no perch.`
  );
}

async function main() {
  const cfg = loadConfig(process.argv.slice(2));
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const pinnedModel = process.env.GEMINI_IMAGE_MODEL || undefined;
  const maxPerRun = Number(process.env.MAX_PER_RUN || DEFAULT_MAX_PER_RUN);
  const webDir = path.resolve(
    process.env.WEB_DIR || path.join(process.cwd(), "..", "..", "apps", "web")
  );

  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const species = await fetchSpeciesList(cfg);
  const have = await existingCutouts(webDir);

  // A species needs art if it has no manifest entry (the collage filters on
  // that) or the PNG is missing. Both must hold for it to actually render.
  const missing: { sci: string; com: string; slug: string }[] = [];
  for (const { sci_name, com_name } of species) {
    const slug = sciToSlug(sci_name);
    const pngPath = path.join(webDir, "public", "birds", `${slug}.png`);
    if (!have.has(slug) || !(await exists(pngPath))) {
      missing.push({ sci: sci_name, com: com_name, slug });
    }
  }

  console.log(
    `[images] ${species.length} species detected, ${have.size} with cutouts, ` +
      `${missing.length} missing`
  );

  await fs.mkdir(RAW_DIR, { recursive: true });

  if (missing.length === 0) {
    await fs.writeFile(PENDING, "[]");
    console.log("[images] nothing to generate.");
    return;
  }

  const batch = missing.slice(0, maxPerRun);
  if (missing.length > batch.length) {
    console.log(
      `[images] generating ${batch.length} this run (MAX_PER_RUN=${maxPerRun}); ` +
        `${missing.length - batch.length} will follow on later runs.`
    );
  }

  const model = await resolveImageModel(apiKey, pinnedModel);
  console.log(`[images] using model: ${model}`);

  const features = await loadFeatures(cfg.speciesDataUrl);
  const pending: PendingItem[] = [];
  const failures: string[] = [];

  for (const { sci, com, slug } of batch) {
    // Fall back to the scientific name so the prompt template stays intact.
    const hint = features[sci]?.wikiSummary || sci;
    try {
      const bytes = await generateImage(apiKey, model, buildPrompt(com, hint));
      const raw = path.join(RAW_DIR, `${slug}.png`);
      await fs.writeFile(raw, bytes);
      pending.push({ slug, comName: com, sciName: sci, raw });
      console.log(`[images] generated ${slug} (${com}) ${bytes.length}b`);
    } catch (err) {
      // Keep going: one bad species shouldn't block the rest of the batch.
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${slug}: ${msg}`);
      console.error(`[images] FAILED ${slug}: ${msg}`);
    }
  }

  await fs.writeFile(PENDING, JSON.stringify(pending, null, 2));
  console.log(`[images] wrote ${pending.length} raw image(s) -> ${PENDING}`);

  // Fail the job only if nothing succeeded — that signals a systemic problem
  // (dead key, retired model, billing) rather than one awkward species.
  if (pending.length === 0 && failures.length > 0) {
    throw new Error(`all ${failures.length} generation(s) failed:\n${failures.join("\n")}`);
  }
}

main().catch((err) => {
  console.error("[images] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
