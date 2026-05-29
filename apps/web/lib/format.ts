// Pure helpers safe for both client and server components.

import type { EnrichmentMap } from "./types";

export function genusOf(sci: string): string {
  return sci.split(" ", 1)[0] ?? "";
}

export function wikiUrl(sci: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(
    sci.replace(/ /g, "_")
  )}`;
}

export function ebirdUrl(sci: string): string {
  // No species code from the name alone; link to eBird's search instead.
  return `https://ebird.org/search?q=${encodeURIComponent(sci)}`;
}

export function confidencePct(c: number): string {
  return `${Math.round(c * 100)}%`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface ResolvedSpecies {
  imageUrl?: string;
  imageIsAi: boolean;
  wikiSummary?: string;
  wikiUrl: string;
  ebirdUrl: string;
  genus: string;
}

// Merge stored enrichment with computed fallbacks. Links and genus always
// resolve from the scientific name even with no enrichment record.
export function resolveSpecies(
  map: EnrichmentMap,
  sci: string
): ResolvedSpecies {
  const e = map[sci] ?? {};
  return {
    imageUrl: e.imageUrl,
    imageIsAi: e.imageIsAi ?? false,
    wikiSummary: e.wikiSummary,
    wikiUrl: e.wikiUrl ?? wikiUrl(sci),
    ebirdUrl: e.ebirdUrl ?? ebirdUrl(sci),
    genus: e.genus ?? genusOf(sci),
  };
}
