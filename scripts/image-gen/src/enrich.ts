import type { SpeciesEnrichment } from "./types.js";

// Wikimedia asks for a descriptive User-Agent on API traffic.
const UA =
  "raamins-birds/1.0 (https://birds.raaminmostaghimi.com; species enrichment)";
const GENUS_QID = "Q34740"; // Wikidata item for taxonomic rank "genus"

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

async function getJson<T = any>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// Resolve the Wikidata item id (Q…) for a scientific name, following redirects.
async function wikidataId(sci: string): Promise<string | null> {
  const data = await getJson<any>(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(
      sci
    )}`
  );
  const pages = data?.query?.pages;
  if (!pages) return null;
  const first: any = Object.values(pages)[0];
  return first?.pageprops?.wikibase_item ?? null;
}

function claimEntityId(entity: any, prop: string): string | null {
  return entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value?.id ?? null;
}
function claimString(entity: any, prop: string): string | null {
  const v = entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  return typeof v === "string" ? v : null;
}

async function fetchEntity(qid: string): Promise<any | null> {
  const data = await getJson<any>(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
  );
  return data?.entities?.[qid] ?? null;
}

// Walk parent-taxon links (P171) up from the species until we hit rank=genus,
// then return that taxon's name (P225). Authoritative — never a string split.
async function genusFromWikidata(speciesQid: string): Promise<string | undefined> {
  const species = await fetchEntity(speciesQid);
  let currentQid = claimEntityId(species, "P171");
  for (let hops = 0; hops < 5 && currentQid; hops++) {
    const ent = await fetchEntity(currentQid);
    if (!ent) break;
    if (claimEntityId(ent, "P105") === GENUS_QID) {
      return claimString(ent, "P225") ?? undefined;
    }
    currentQid = claimEntityId(ent, "P171");
  }
  return undefined;
}

// Pull all TEXT enrichment for one species. Description from Wikipedia, genus
// from Wikidata. The scientific name itself stays as BirdNET reported it.
export async function enrich(sci: string): Promise<SpeciesEnrichment> {
  const out: SpeciesEnrichment = {};

  const summary = await getJson<any>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      sci.replace(/ /g, "_")
    )}`
  );
  if (summary?.extract) out.wikiSummary = firstSentence(summary.extract);
  if (summary?.content_urls?.desktop?.page) {
    out.wikiUrl = summary.content_urls.desktop.page;
  }

  const qid: string | null = summary?.wikibase_item ?? (await wikidataId(sci));
  if (qid) {
    const genus = await genusFromWikidata(qid);
    if (genus) out.genus = genus;
  }

  return out;
}
