import type { Config } from "./config.js";
import type { SpeciesListEntry } from "./types.js";

export async function fetchSpeciesList(
  cfg: Config
): Promise<SpeciesListEntry[]> {
  if (!cfg.apiBase) {
    throw new Error(
      "BIRD_API_URL is not set — cannot list species. Set it to the Pi tunnel URL."
    );
  }
  const res = await fetch(`${cfg.apiBase}/api/species-list`);
  if (!res.ok) {
    throw new Error(`species-list responded ${res.status}`);
  }
  return (await res.json()) as SpeciesListEntry[];
}
