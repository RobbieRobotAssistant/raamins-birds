import "server-only";

import { SPECIES_DATA_URL } from "./config";
import type { EnrichmentMap } from "./types";

// Species metadata (image URL, Wikipedia summary, links) is enriched offline
// by scripts/image-gen and stored as species.json in Vercel Blob. We fetch it
// once and let the Next data cache hold it; never per page load.
export async function getEnrichment(): Promise<EnrichmentMap> {
  if (!SPECIES_DATA_URL) return {};
  try {
    const res = await fetch(SPECIES_DATA_URL, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    return (await res.json()) as EnrichmentMap;
  } catch {
    return {};
  }
}
