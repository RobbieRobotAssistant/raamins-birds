// Deterministic, internally-consistent mock data shaped exactly like the Pi
// API. Used when BIRD_API_URL is unset (or USE_MOCKS=1) so the whole frontend
// can be built and verified before the Pi is reachable. One seeded base
// dataset feeds every endpoint, so life-list counts match top-species, etc.

import type {
  Detection,
  FirstDetection,
  PeriodBucket,
  SpeciesDetail,
  SpeciesListEntry,
  SpeciesListItem,
  TopSpecies,
  Window,
} from "./types";

const SPECIES: Array<{ sci: string; com: string; weight: number }> = [
  { sci: "Cyanistes caeruleus", com: "Eurasian Blue Tit", weight: 9 },
  { sci: "Parus major", com: "Great Tit", weight: 8 },
  { sci: "Erithacus rubecula", com: "European Robin", weight: 7 },
  { sci: "Turdus merula", com: "Eurasian Blackbird", weight: 7 },
  { sci: "Passer domesticus", com: "House Sparrow", weight: 10 },
  { sci: "Columba palumbus", com: "Common Wood-Pigeon", weight: 5 },
  { sci: "Fringilla coelebs", com: "Common Chaffinch", weight: 6 },
  { sci: "Sturnus vulgaris", com: "European Starling", weight: 8 },
  { sci: "Pica pica", com: "Eurasian Magpie", weight: 4 },
  { sci: "Carduelis carduelis", com: "European Goldfinch", weight: 5 },
];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Base {
  rowid: number;
  sci: string;
  com: string;
  conf: number;
  minutesAgo: number;
}

const WEIGHTED: typeof SPECIES = SPECIES.flatMap((s) =>
  Array(s.weight).fill(s)
);

const BASE: Base[] = (() => {
  const rand = mulberry32(42);
  const rows: Base[] = [];
  const EIGHT_DAYS_MIN = 8 * 24 * 60;
  for (let i = 0; i < 600; i++) {
    const s = WEIGHTED[Math.floor(rand() * WEIGHTED.length)];
    // Exponential-ish skew toward recent.
    const minutesAgo =
      Math.floor(-Math.log(1 - rand()) * 1800) % EIGHT_DAYS_MIN;
    rows.push({
      rowid: i + 1,
      sci: s.sci,
      com: s.com,
      conf: Math.round((0.6 + rand() * 0.39) * 10000) / 10000,
      minutesAgo,
    });
  }
  return rows.sort((a, b) => a.minutesAgo - b.minutesAgo);
})();

const WINDOW_MINUTES: Record<Window, number> = {
  "1h": 60,
  "12h": 720,
  "24h": 1440,
  "7d": 10080,
  all: Number.POSITIVE_INFINITY,
};

const BUCKET_MS: Record<Window, number> = {
  "1h": 5 * 60 * 1000,
  "12h": 30 * 60 * 1000,
  "24h": 60 * 60 * 1000,
  "7d": 24 * 60 * 60 * 1000,
  all: 24 * 60 * 60 * 1000,
};

function iso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60000).toISOString().slice(0, 19);
}

function inWindow(window: Window) {
  const max = WINDOW_MINUTES[window];
  return BASE.filter((r) => r.minutesAgo <= max);
}

function genus(sci: string): string {
  return sci.split(" ", 1)[0] ?? "";
}

export function mockDetections(window: Window, limit: number): Detection[] {
  return inWindow(window)
    .slice(0, limit)
    .map((r) => ({
      rowid: r.rowid,
      sci_name: r.sci,
      com_name: r.com,
      confidence: r.conf,
      date: iso(r.minutesAgo).slice(0, 10),
      time: iso(r.minutesAgo).slice(11),
      timestamp: iso(r.minutesAgo),
      recording_url: `/api/recordings/${r.rowid}`,
    }));
}

interface Agg {
  sci: string;
  com: string;
  count: number;
  firstAgo: number;
  lastAgo: number;
}

function aggregate(rows: Base[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    const a = m.get(r.sci);
    if (!a) {
      m.set(r.sci, {
        sci: r.sci,
        com: r.com,
        count: 1,
        firstAgo: r.minutesAgo,
        lastAgo: r.minutesAgo,
      });
    } else {
      a.count++;
      a.firstAgo = Math.max(a.firstAgo, r.minutesAgo);
      a.lastAgo = Math.min(a.lastAgo, r.minutesAgo);
    }
  }
  return m;
}

export function mockLifeList(sort: "count" | "recent" | "alpha"): SpeciesListItem[] {
  const items = [...aggregate(BASE).values()].map((a) => ({
    sci_name: a.sci,
    com_name: a.com,
    count: a.count,
    last_heard: iso(a.lastAgo),
  }));
  if (sort === "count") items.sort((a, b) => b.count - a.count);
  else if (sort === "recent")
    items.sort((a, b) => b.last_heard.localeCompare(a.last_heard));
  else items.sort((a, b) => a.com_name.localeCompare(b.com_name));
  return items;
}

export function mockSpeciesList(): SpeciesListEntry[] {
  return [...aggregate(BASE).values()]
    .map((a) => ({ sci_name: a.sci, com_name: a.com }))
    .sort((a, b) => a.com_name.localeCompare(b.com_name));
}

export function mockSpeciesDetail(
  sci: string,
  window: Window
): SpeciesDetail | null {
  const all = aggregate(BASE).get(sci);
  if (!all) return null;
  const windowCount = inWindow(window).filter((r) => r.sci === sci).length;
  const recent = BASE.filter((r) => r.sci === sci)
    .slice(0, 12)
    .map((r) => ({
      rowid: r.rowid,
      timestamp: iso(r.minutesAgo),
      confidence: r.conf,
      recording_url: `/api/recordings/${r.rowid}`,
    }));
  return {
    sci_name: sci,
    com_name: all.com,
    genus: genus(sci),
    all_time_count: all.count,
    window_count: windowCount,
    first_heard: iso(all.firstAgo),
    last_heard: iso(all.lastAgo),
    recent,
  };
}

export function mockTopSpecies(window: Window, limit: number): TopSpecies[] {
  return [...aggregate(inWindow(window)).values()]
    .map((a) => ({ sci_name: a.sci, com_name: a.com, count: a.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function mockFirstDetections(limit: number): FirstDetection[] {
  return [...aggregate(BASE).values()]
    .map((a) => ({
      sci_name: a.sci,
      com_name: a.com,
      first_heard: iso(a.firstAgo),
    }))
    .sort((a, b) => b.first_heard.localeCompare(a.first_heard))
    .slice(0, limit);
}

export function mockByPeriod(window: Window): PeriodBucket[] {
  const bucketMs = BUCKET_MS[window];
  const counts = new Map<number, number>();
  for (const r of inWindow(window)) {
    const t = Date.now() - r.minutesAgo * 60000;
    const bucket = Math.floor(t / bucketMs) * bucketMs;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, count]) => ({
      bucket: new Date(ms).toISOString().slice(0, 19),
      count,
    }));
}
