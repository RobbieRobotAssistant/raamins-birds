// Mirrors the Pi API's response models (apps/pi-api/app/models.py).

export type Window = "1h" | "12h" | "24h" | "7d" | "all";
export type Sort = "count" | "recent" | "alpha";

export interface Detection {
  rowid: number;
  sci_name: string;
  com_name: string;
  confidence: number;
  date: string;
  time: string;
  timestamp: string;
  recording_url: string;
}

export interface SpeciesListItem {
  sci_name: string;
  com_name: string;
  count: number;
  last_heard: string;
}

export interface RecentDetection {
  rowid: number;
  timestamp: string;
  confidence: number;
  recording_url: string;
}

export interface SpeciesDetail {
  sci_name: string;
  com_name: string;
  genus: string;
  all_time_count: number;
  window_count: number;
  first_heard: string;
  last_heard: string;
  recent: RecentDetection[];
}

export interface TopSpecies {
  sci_name: string;
  com_name: string;
  count: number;
}

export interface FirstDetection {
  sci_name: string;
  com_name: string;
  first_heard: string;
}

export interface PeriodBucket {
  bucket: string;
  count: number;
}

export interface SpeciesListEntry {
  sci_name: string;
  com_name: string;
}

// Enrichment record per species (from species.json in Vercel Blob).
export interface SpeciesEnrichment {
  imageUrl?: string;
  imageIsAi?: boolean;
  wikiSummary?: string;
  wikiUrl?: string;
  ebirdUrl?: string;
  genus?: string;
}

export type EnrichmentMap = Record<string, SpeciesEnrichment>;

// A viewer-submitted misidentification report.
export interface BirdReport {
  id: string;
  rowid: number;
  sci_name: string;
  com_name: string;
  incorrect: boolean; // answer to "is this incorrectly identified?"
  actual: string; // free text: "what is it really?"
  created: string; // ISO 8601
}
