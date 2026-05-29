import { fetchSpeciesList } from "./api.js";
import { loadConfig } from "./config.js";
import { enrich } from "./enrich.js";
import { loadExisting, writeSpeciesJson } from "./storage.js";
import type { EnrichmentMap } from "./types.js";

// Text-only species enrichment. Lists detected species from the Pi API, fetches
// a one-line Wikipedia description + Wikidata genus for any species we don't yet
// have data for, and writes species.json to Vercel Blob. Idempotent: species
// that already have text are skipped, so a scheduled run does minimal work.
async function main() {
  const cfg = loadConfig(process.argv.slice(2));
  console.log(`[enrich] dryRun=${cfg.dryRun}`);

  const existing = await loadExisting(cfg);
  const species = await fetchSpeciesList(cfg);
  console.log(`[enrich] ${species.length} species from API`);

  const result: EnrichmentMap = { ...existing };
  let enriched = 0;

  for (const { sci_name } of species) {
    const cur = result[sci_name];
    // Skip if we already have any text for this species (idempotent).
    if (cur && (cur.wikiSummary || cur.genus)) continue;

    const e = await enrich(sci_name);
    result[sci_name] = { ...(cur ?? {}), ...e };
    enriched++;
    console.log(
      `[enrich] ${sci_name} -> genus=${e.genus ?? "?"} summary=${
        e.wikiSummary ? "yes" : "no"
      }`
    );
  }

  const url = await writeSpeciesJson(cfg, result);
  console.log(`[enrich] done. newlyEnriched=${enriched}`);
  console.log(`[enrich] species.json -> ${url}`);
  if (cfg.dryRun || !cfg.blobToken) {
    console.log("[enrich] (dry-run/no token: wrote locally under out/)");
  }
}

main().catch((err) => {
  console.error("[enrich] failed:", err);
  process.exit(1);
});
