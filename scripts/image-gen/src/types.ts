export interface SpeciesListEntry {
  sci_name: string;
  com_name: string;
}

// Text-only enrichment, keyed by Sci_Name. Images are handled separately by
// the cutout pipeline (committed to the repo), not by this script.
export interface SpeciesEnrichment {
  wikiSummary?: string; // one-line description from Wikipedia
  genus?: string; // from Wikidata (authoritative); absent if unknown
  wikiUrl?: string; // canonical Wikipedia article URL
}

export type EnrichmentMap = Record<string, SpeciesEnrichment>;
