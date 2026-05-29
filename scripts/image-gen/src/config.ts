export interface Config {
  apiBase: string;
  speciesDataUrl: string;
  blobToken: string;
  provider: "none" | "openai";
  openaiKey: string;
  openaiModel: string;
  maxGenerations: number;
  dryRun: boolean;
  providedDir: string;
}

export function loadConfig(argv: string[]): Config {
  const provider = (process.env.IMAGE_PROVIDER || "none") as Config["provider"];
  return {
    apiBase: (process.env.BIRD_API_URL || "").replace(/\/+$/, ""),
    speciesDataUrl: process.env.SPECIES_DATA_URL || "",
    blobToken: process.env.BLOB_READ_WRITE_TOKEN || "",
    provider: provider === "openai" ? "openai" : "none",
    openaiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    maxGenerations: Number(process.env.MAX_GENERATIONS || "10"),
    dryRun: argv.includes("--dry-run"),
    providedDir: "provided-images",
  };
}

export function slugify(sciName: string): string {
  return sciName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
