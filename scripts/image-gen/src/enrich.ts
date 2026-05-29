import type { SpeciesEnrichment } from "./types.js";

function genusOf(sci: string): string {
  return sci.split(" ", 1)[0] ?? "";
}

function ebirdUrl(sci: string): string {
  return `https://ebird.org/search?q=${encodeURIComponent(sci)}`;
}

function wikiUrl(sci: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(
    sci.replace(/ /g, "_")
  )}`;
}

// Fetch the Wikipedia REST summary once per species. Stored in species.json so
// the frontend never refetches it. Failures degrade to computed links only.
export async function enrich(sci: string): Promise<SpeciesEnrichment> {
  const base: SpeciesEnrichment = {
    genus: genusOf(sci),
    wikiUrl: wikiUrl(sci),
    ebirdUrl: ebirdUrl(sci),
  };
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        sci.replace(/ /g, "_")
      )}`,
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) return base;
    const data = (await res.json()) as {
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    return {
      ...base,
      wikiSummary: data.extract || undefined,
      wikiUrl: data.content_urls?.desktop?.page || base.wikiUrl,
    };
  } catch {
    return base;
  }
}
