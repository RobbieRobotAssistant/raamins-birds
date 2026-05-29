import { fetchSpeciesList } from "./api.js";
import { loadConfig, slugify } from "./config.js";
import { enrich } from "./enrich.js";
import { generateImage } from "./providers.js";
import {
  loadExisting,
  readProvidedImage,
  uploadImage,
  writeSpeciesJson,
} from "./storage.js";
import type { EnrichmentMap } from "./types.js";

async function main() {
  const cfg = loadConfig(process.argv.slice(2));
  console.log(
    `[image-gen] provider=${cfg.provider} dryRun=${cfg.dryRun} cap=${cfg.maxGenerations}`
  );

  const existing = await loadExisting(cfg);
  const species = await fetchSpeciesList(cfg);
  console.log(`[image-gen] ${species.length} species from API`);

  const result: EnrichmentMap = { ...existing };
  let generated = 0;
  let provided = 0;
  let enriched = 0;

  for (const { sci_name, com_name } of species) {
    const slug = slugify(sci_name);
    const cur = { ...(result[sci_name] ?? {}) };

    // 1) Enrichment: fetch Wikipedia summary once, only if missing.
    if (!cur.wikiSummary && !cur.genus) {
      Object.assign(cur, await enrich(sci_name));
      enriched++;
    } else if (!cur.genus) {
      Object.assign(cur, await enrich(sci_name));
    }

    // 2) Image. A finalized real image (imageIsAi === false) is never touched.
    const hasRealImage = cur.imageUrl && cur.imageIsAi === false;
    if (!hasRealImage) {
      const file = await readProvidedImage(cfg, slug);
      if (file) {
        // Manually-provided image wins; mark as a real (non-AI) illustration.
        cur.imageUrl = await uploadImage(cfg, slug, file.bytes, file.ext);
        cur.imageIsAi = false;
        delete cur.placeholder;
        provided++;
      } else if (!cur.imageUrl) {
        // No image yet. Try the provider (capped); else leave a placeholder
        // so the UI renders the common-name text.
        if (cfg.provider === "openai" && generated < cfg.maxGenerations) {
          const img = await generateImage(cfg, sci_name, com_name);
          if (img) {
            cur.imageUrl = await uploadImage(cfg, slug, img.bytes, img.ext);
            cur.imageIsAi = true;
            delete cur.placeholder;
            generated++;
          } else {
            cur.placeholder = true;
          }
        } else {
          cur.placeholder = true;
        }
      }
    }

    result[sci_name] = cur;
  }

  const url = await writeSpeciesJson(cfg, result);
  console.log(
    `[image-gen] done. enriched=${enriched} providedImages=${provided} aiGenerated=${generated}`
  );
  console.log(`[image-gen] species.json -> ${url}`);
  if (cfg.dryRun || !cfg.blobToken) {
    console.log("[image-gen] (dry-run/no token: wrote locally under out/)");
  }
}

main().catch((err) => {
  console.error("[image-gen] failed:", err);
  process.exit(1);
});
