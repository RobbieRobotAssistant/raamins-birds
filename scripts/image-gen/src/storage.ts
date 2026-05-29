import { promises as fs } from "node:fs";
import path from "node:path";

import { put } from "@vercel/blob";

import type { Config } from "./config.js";
import type { EnrichmentMap } from "./types.js";

const OUT_DIR = "out";
const SPECIES_JSON = "species.json";

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
