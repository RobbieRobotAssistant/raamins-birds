export interface SpeciesListEntry {
  sci_name: string;
  com_name: string;
}

export interface SpeciesEnrichment {
  imageUrl?: string;
  imageIsAi?: boolean;
  placeholder?: boolean; // true => no real image yet; UI shows text placeholder
  wikiSummary?: string;
  wikiUrl?: string;
  ebirdUrl?: string;
  genus?: string;
}

export type EnrichmentMap = Record<string, SpeciesEnrichment>;
