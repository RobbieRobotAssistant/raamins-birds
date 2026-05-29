// Centralized server-side config. Read once; never expose BIRD_API_URL to the
// client (visitors only ever talk to our same-origin /api routes).

export const BIRD_API_URL = (process.env.BIRD_API_URL || "").replace(/\/+$/, "");
export const SPECIES_DATA_URL = process.env.SPECIES_DATA_URL || "";

// Mock mode: no Pi configured, or explicitly forced.
export const USE_MOCKS = process.env.USE_MOCKS === "1" || BIRD_API_URL === "";

// Seconds the Next data cache holds an upstream Pi response. This is what
// shields the Pi: many visitors, at most one upstream hit per window/endpoint
// per revalidation period.
export const REVALIDATE = 60;

// Audio clips are immutable; cache them far longer.
export const AUDIO_REVALIDATE = 60 * 60 * 24;
