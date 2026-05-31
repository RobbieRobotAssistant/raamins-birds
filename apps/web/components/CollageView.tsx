"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useFetch } from "@/lib/useFetch";
import type { TopSpecies, Window } from "@/lib/types";
import { EmptyState, ErrorState, LoadingGrid } from "./States";
import { CUTOUTS, type CutoutEntry } from "@/lib/cutouts.generated";

/**
 * Frequency-weighted, ellipse-biased spiral collage.
 *
 * Sizing (after Twarner491's AvianVisitors): each species' area is a sub-linear
 * function of its detection count (count^0.65), normalized against a viewport
 * area BUDGET rather than hard-clamped — so a very common bird looms over a rare
 * one without flattening the hierarchy or blowing out the layout. A floor keeps
 * rare species from becoming specks.
 *
 * Packing: center-out spiral (biggest/most-detected at the centre), but the
 * search is stretched into an ELLIPSE whose orientation follows the breakpoint —
 * wide on desktop (landscape screens), TALL on mobile (portrait phones). A final
 * scale-to-fit maps the packed cluster to the measured width and caps height.
 * Re-packs only when the breakpoint bucket or species set changes.
 */

const CELL_PX = 8;
const FREQ_EXP = 0.65; // sub-linear exponent for count -> size

type Bucket = "m" | "t" | "d";

interface BucketCfg {
  refW: number; // reference canvas width for the area budget
  refH: number; // reference canvas height
  ex: number; // spiral x-stretch (ellipse bias)
  ey: number; // spiral y-stretch
}

function bucketCfg(b: Bucket): BucketCfg {
  if (b === "m") return { refW: 390, refH: 560, ex: 1.0, ey: 1.4 }; // tall ellipse
  if (b === "t") return { refW: 760, refH: 720, ex: 1.35, ey: 1.0 };
  return { refW: 1024, refH: 620, ex: 2.1, ey: 1.0 }; // wide ellipse
}

type Placed = {
  sci: string;
  com: string;
  count: number;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

interface PackResult {
  placed: Placed[];
  width: number;
  height: number;
}

function sciToSlug(sci: string): string {
  return sci.toLowerCase().trim().replace(/\s+/g, "-");
}

function resolveImg(sci: string): string | null {
  const slug = sciToSlug(sci);
  return CUTOUTS[slug] ? `/birds/${slug}.png` : null;
}

function packBirds(species: TopSpecies[], cfg: BucketCfg): PackResult {
  const empty: PackResult = { placed: [], width: 0, height: 0 };

  // Keep species that have a cutout; most-detected first (biggest -> centre).
  const items = species
    .filter((s) => CUTOUTS[sciToSlug(s.sci_name)])
    .sort((a, b) => b.count - a.count);
  if (items.length === 0) return empty;

  // --- Frequency-weighted, budget-normalized sizing ---
  const scores = items.map((s) => Math.pow(Math.max(1, s.count), FREQ_EXP));
  const sumS = scores.reduce((a, b) => a + b, 0);
  const n = items.length;
  // Fewer species -> larger share of the canvas; more species -> smaller.
  const budgetFraction = Math.max(0.18, Math.min(0.3, 0.3 - (n - 6) * 0.006));
  const budget = cfg.refW * cfg.refH * budgetFraction;
  const rawArea = scores.map((s) => (budget / sumS) * s);
  const maxArea = Math.max(...rawArea);
  const minArea = 0.14 * maxArea; // floor: smallest ~37% the width of the biggest

  type Sized = {
    sci: string;
    com: string;
    count: number;
    src: string;
    pxW: number;
    pxH: number;
    cells: { x: number; y: number }[];
    cellW: number;
    cellH: number;
  };

  const sized: Sized[] = [];
  items.forEach((s, i) => {
    const entry = CUTOUTS[sciToSlug(s.sci_name)] as CutoutEntry;
    const src = resolveImg(s.sci_name);
    if (!entry || !src) return;
    const mh = entry.mask.length;
    const mw = entry.mask[0]?.length ?? 0;
    if (!mw || !mh) return;

    const ar = entry.w / entry.h;
    const area = Math.max(minArea, rawArea[i]);
    const pxW = Math.max(1, Math.round(Math.sqrt(area * ar)));
    const pxH = Math.max(1, Math.round(Math.sqrt(area / ar)));

    const cellW = Math.max(1, Math.ceil(pxW / CELL_PX));
    const cellH = Math.max(1, Math.ceil(pxH / CELL_PX));
    const cells: { x: number; y: number }[] = [];
    for (let cy = 0; cy < cellH; cy++) {
      for (let cx = 0; cx < cellW; cx++) {
        const mx = Math.min(mw - 1, Math.floor(((cx + 0.5) / cellW) * mw));
        const my = Math.min(mh - 1, Math.floor(((cy + 0.5) / cellH) * mh));
        if (entry.mask[my][mx]) cells.push({ x: cx, y: cy });
      }
    }
    if (cells.length) {
      sized.push({
        sci: s.sci_name,
        com: s.com_name,
        count: s.count,
        src,
        pxW,
        pxH,
        cells,
        cellW,
        cellH,
      });
    }
  });
  if (sized.length === 0) return empty;

  // --- Ellipse-biased center-out spiral ---
  const totalCells = sized.reduce((a, s) => a + s.cellW * s.cellH, 0);
  const side = Math.max(80, Math.ceil(Math.sqrt(totalCells) * 5));
  const cols = side;
  const rows = side;
  const occ = new Uint8Array(cols * rows);
  const cc = Math.floor(cols / 2);
  const cr = Math.floor(rows / 2);

  const fits = (col: number, row: number, s: Sized): boolean => {
    if (col < 0 || row < 0 || col + s.cellW >= cols || row + s.cellH >= rows) {
      return false;
    }
    for (const c of s.cells) {
      if (occ[(row + c.y) * cols + (col + c.x)]) return false;
    }
    return true;
  };
  const mark = (col: number, row: number, s: Sized) => {
    for (const c of s.cells) occ[(row + c.y) * cols + (col + c.x)] = 1;
  };

  const maxR = Math.max(cols, rows);
  const placed: Placed[] = [];
  for (let i = 0; i < sized.length; i++) {
    const s = sized[i];
    const aCol = cc - Math.floor(s.cellW / 2);
    const aRow = cr - Math.floor(s.cellH / 2);
    let spot: { c: number; r: number } | null = null;

    if (i === 0 && fits(aCol, aRow, s)) {
      spot = { c: aCol, r: aRow };
    } else {
      for (let radius = 0; radius <= maxR && !spot; radius++) {
        const samples = Math.max(8, radius * 8);
        for (let k = 0; k < samples; k++) {
          const th = (k / samples) * Math.PI * 2;
          // Ellipse bias: stretch the search per axis so the cluster elongates
          // horizontally (desktop) or vertically (mobile).
          const c = aCol + Math.round(Math.cos(th) * radius * cfg.ex);
          const r = aRow + Math.round(Math.sin(th) * radius * cfg.ey);
          if (fits(c, r, s)) {
            spot = { c, r };
            break;
          }
        }
      }
    }
    if (!spot) continue;
    mark(spot.c, spot.r, s);
    placed.push({
      sci: s.sci,
      com: s.com,
      count: s.count,
      src: s.src,
      x: spot.c * CELL_PX,
      y: spot.r * CELL_PX,
      w: s.pxW,
      h: s.pxH,
    });
  }
  if (placed.length === 0) return empty;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  }
  const norm = placed.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }));
  return { placed: norm, width: maxX - minX, height: maxY - minY };
}

// Phrasing for the hover card's count line, per time window.
const WINDOW_SUFFIX: Record<Window, string> = {
  "1h": "in the last hour",
  "12h": "in the last 12 hours",
  "24h": "today",
  "7d": "this week",
  all: "all-time",
};

export default function CollageView({
  window: win,
  onSelect,
}: {
  window: Window;
  onSelect: (sci: string) => void;
}) {
  const { data: topData, error } = useFetch<TopSpecies[]>(
    `/api/stats/top-species?window=${win}&limit=100`
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredW, setMeasuredW] = useState(0);
  const [viewportH, setViewportH] = useState(900);
  // Desktop hover field-card state.
  const [hovered, setHovered] = useState<{
    com: string;
    sci: string;
    count: number;
  } | null>(null);
  const [hoverVisible, setHoverVisible] = useState(false);
  // True once a real mouse/pen pointer has hovered a bird. Gates the card so it
  // never appears on touch — without relying on (any-)hover media queries,
  // which misreport "no hover" on many Windows mouse desktops.
  const [pointerFine, setPointerFine] = useState(false);

  useEffect(() => {
    setViewportH(window.innerHeight);
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setMeasuredW(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bucket: Bucket = measuredW < 500 ? "m" : measuredW < 900 ? "t" : "d";
  const measured = measuredW >= 50;

  // Arrangement: re-pack only on species-set or breakpoint change.
  const pack = useMemo<PackResult | null>(() => {
    if (!topData || topData.length === 0 || !measured) return null;
    return packBirds(topData, bucketCfg(bucket));
  }, [topData, bucket, measured]);

  // Scale the packed cluster to fill the measured width; cap height at 85vh.
  const layout = useMemo(() => {
    if (!pack || pack.placed.length === 0) return null;
    const avail = Math.min(measuredW, 1024);
    // Leave room for the sticky header bar so the whole cluster is visible
    // below it (not scrolled under it). ~130px covers the pinned bar + margin.
    const maxH = Math.max(320, viewportH - 130);
    // Fill the available width; back off only if that would exceed the height
    // budget. Capped at 1.4x so birds don't balloon when few species are shown.
    const scale = Math.min((avail * 0.99) / pack.width, maxH / pack.height, 1.4);
    return {
      scale,
      contentH: pack.height * scale,
      offsetX: (avail - pack.width * scale) / 2,
    };
  }, [pack, measuredW, viewportH]);

  return (
    <>
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-5xl overflow-hidden"
        style={{ minHeight: 360 }}
      >
        {error ? (
          <ErrorState message={error} />
        ) : !topData ? (
          <LoadingGrid />
        ) : topData.length === 0 ? (
          <EmptyState message="No detections in this window yet." />
        ) : measuredW === 0 ? (
          <LoadingGrid />
        ) : pack && pack.placed.length === 0 ? (
          <EmptyState message="No illustrations for this window's species yet." />
        ) : layout && pack ? (
          <div className="relative" style={{ height: layout.contentH }}>
            {pack.placed.map((p) => (
              <button
                key={p.sci}
                onClick={() => onSelect(p.sci)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "touch") return;
                  setPointerFine(true);
                  setHovered({ com: p.com, sci: p.sci, count: p.count });
                  setHoverVisible(true);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "touch") return;
                  setHoverVisible(false);
                }}
                title={p.com}
                className="absolute select-none transition-transform duration-200 hover:z-10 hover:scale-[1.04]"
                style={{
                  left: layout.offsetX + p.x * layout.scale,
                  top: p.y * layout.scale,
                  width: p.w * layout.scale,
                  height: p.h * layout.scale,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.com}
                  draggable={false}
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>
        ) : (
          <LoadingGrid />
        )}
      </div>

      {/* Hover field-card, centered just below the collage. Only rendered once
          a real mouse/pen pointer has hovered a bird, so it never shows on
          touch devices (no flaky hover media queries involved). */}
      {pointerFine && (
        <div className="hover-card-slot mx-auto mt-4 flex min-h-[88px] w-full max-w-5xl justify-center px-5 sm:px-8">
          {hovered && (
            <div
              className={`pointer-events-none select-none rounded-lg border hairline bg-paper px-5 py-3 text-center shadow-[0_2px_16px_rgba(20,18,15,0.08)] transition-opacity duration-200 ease-out ${
                hoverVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="serif text-lg leading-tight text-ink">
                {hovered.com}
              </div>
              <div className="font-mono text-[0.8rem] italic text-muted">
                ({hovered.sci})
              </div>
              <div className="mt-1.5 text-sm text-ink/90">
                seen <span className="font-semibold">{hovered.count}</span>{" "}
                {hovered.count === 1 ? "time" : "times"} {WINDOW_SUFFIX[win]}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
