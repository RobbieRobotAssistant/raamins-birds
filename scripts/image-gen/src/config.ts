export interface Config {
  apiBase: string;
  speciesDataUrl: string;
  blobToken: string;
  dryRun: boolean;
}

export function loadConfig(argv: string[]): Config {
  return {
    apiBase: (process.env.BIRD_API_URL || "").replace(/\/+$/, ""),
    speciesDataUrl: process.env.SPECIES_DATA_URL || "",
    blobToken: process.env.BLOB_READ_WRITE_TOKEN || "",
    dryRun: argv.includes("--dry-run"),
  };
}
