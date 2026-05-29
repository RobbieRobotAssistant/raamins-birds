import { promises as fs } from "node:fs";
import path from "node:path";

import { put } from "@vercel/blob";

import type { Config } from "./config.js";
import type { EnrichmentMap } from "./types.js";

const OUT_DIR = "out";
const SPECIES_JSON = "species.json";
const EXTS = ["png", "jpg", "jpeg", "webp"] as const;

function contentType(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

// Existing map = source of truth for idempotency. Prefer the public Blob URL;
// in dry-run fall back to the local out/species.json from a previous run.
export async function loadExisting(cfg: Config): Promise<EnrichmentMap> {
  if (cfg.speciesDataUrl) {
    try {
      const r = await fetch(`${cfg.speciesDataUrl}?t=${Date.now()}`);
      if (r.ok) return (await r.json()) as EnrichmentMap;
    } catch {
      /* fall through */
    }
  }
  if (cfg.dryRun) {
    try {
      const txt = await fs.readFile(path.join(OUT_DIR, SPECIES_JSON), "utf8");
      return JSON.parse(txt) as EnrichmentMap;
    } catch {
      /* none yet */
    }
  }
  return {};
}

// Look for a manually-provided image named <slug>.<ext> in provided-images/.
export async function readProvidedImage(
  cfg: Config,
  slug: string
): Promise<{ bytes: Buffer; ext: string } | null> {
  for (const ext of EXTS) {
    const p = path.join(cfg.providedDir, `${slug}.${ext}`);
    try {
      const bytes = await fs.readFile(p);
      return { bytes, ext: ext === "jpeg" ? "jpg" : ext };
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function uploadImage(
  cfg: Config,
  slug: string,
  bytes: Buffer,
  ext: string
): Promise<string> {
  const pathname = `species/${slug}.${ext}`;
  if (cfg.dryRun || !cfg.blobToken) {
    const dest = path.join(OUT_DIR, pathname);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, bytes);
    return `${OUT_DIR}/${pathname}`;
  }
  const { url } = await put(pathname, bytes, {
    access: "public",
    token: cfg.blobToken,
    addRandomSuffix: false,
    contentType: contentType(ext),
  });
  return url;
}

export async function writeSpeciesJson(
  cfg: Config,
  map: EnrichmentMap
): Promise<string> {
  const body = JSON.stringify(map, null, 2);
  if (cfg.dryRun || !cfg.blobToken) {
    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUT_DIR, SPECIES_JSON), body);
    return `${OUT_DIR}/${SPECIES_JSON}`;
  }
  const { url } = await put(SPECIES_JSON, body, {
    access: "public",
    token: cfg.blobToken,
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return url;
}
