"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFetch } from "@/lib/useFetch";
import { resolveSpecies } from "@/lib/format";
import type { Detection, EnrichmentMap, TopSpecies, Window } from "@/lib/types";
import { EmptyState, ErrorState, LoadingGrid } from "./States";
import { CUTOUTS, type CutoutEntry } from "@/lib/cutouts.generated";

/**
 * Raster-bitmask spiral-pack collage.
 *
 * Each species ships a low-res binary alpha mask (lib/cutouts.generated.ts) at
 * MASK_GRID resolution that traces its actual silhouette (with a small dilation
 * baked in to create visual gaps). We maintain a global occupancy grid sized
 * to the viewport, place a "featured" bird at the cluster centre, then for
 * every subsequent bird spiral outward from the centre and accept the closest
 * position whose mask doesn't overlap any already-placed silhouette.
 *
 * Result: birds nest into each other's concavities (a wing arc cradles a tail,
 * etc.) instead of sitting in a rigid grid.
 */

// --- Tuning knobs -----------------------------------------------------------

// How many viewport pixels a single occupancy cell represents. Smaller = more
// faithful packing but more CPU. 6–10 is the sweet spot.
const CELL_PX = 8;

// Target rendered long-edge of each bird, in viewport pixels. Picked to give
// roughly 12–24 birds visible on a typical viewport without overlap madness.
// We scale individual birds slightly with detection recency, so this is the
// "median" bird.
const TARGET_LONG_EDGE_PX = 180;

// Responsive scale factors: adapt to viewport width
function getScales(vpW: number) {
  if (vpW < 500) return { min: 0.7, max: 0.95 };  // mobile - fill the screen
  if (vpW < 900) return { min: 0.7, max: 1.0 };  // tablet
  return { min: 0.78, max: 1.18 };               // desktop
}

// Range applied per detection based on relative recency (newest = larger).
const SCALE_MIN = 0.78;
const SCALE_MAX = 1.18;

// Spiral search step in cells. Smaller = denser packing, more CPU.
const SPIRAL_STEP = 1;

// How far to search before giving up (cells). 80 is plenty for sane viewports.
const SPIRAL_MAX_RADIUS = 80;

// --- Helpers ----------------------------------------------------------------

type Placed = {
  rowid: number;
  sci: string;
  com: string;
  src: string;
  // Final placement in viewport px
  x: number; // left
  y: number; // top
  w: number;
  h: number;
};

type Detected = Detection & { __featured?: boolean };

function placeBirds(
  birds: Detected[],
  viewportW: number,
  viewportH: number,
  resolveImg: (sci: string) => string | null
): Placed[] {
  if (viewportW < 50 || viewportH < 50) return [];

  const cols = Math.max(1, Math.floor(viewportW / CELL_PX));
  const rows = Math.max(1, Math.floor(viewportH / CELL_PX));
  // 1-D Uint8Array as bit grid (0 = empty, 1 = occupied)
  const occ = new Uint8Array(cols * rows);

  const centreCol = Math.floor(cols / 2);
  const centreRow = Math.floor(rows / 2);

  const placed: Placed[] = [];

  // Pre-bake each bird's mask scaled to its rendered size, in occupancy cells.
  type Prepared = {
    bird: Detected;
    entry: CutoutEntry;
    src: string;
    // Mask scaled to the rendered size, expressed as a list of occupied cells
    // (dx, dy) relative to the bird's top-left.
    cells: { x: number; y: number }[];
    cellW: number;
    cellH: number;
    pxW: number;
    pxH: number;
  };

  const prepared: Prepared[] = [];

  birds.forEach((bird, i) => {
    const slug = sciToSlug(bird.sci_name);
    const entry = CUTOUTS[slug];
    const src = resolveImg(bird.sci_name);
    if (!entry || !src) return; // skip species without a cutout

    // Scale: newer detections (lower index since we order desc) render larger.
    // Use responsive scale factors based on viewport width.
    const scales = getScales(viewportW);
    const denominator = Math.max(1, birds.length - 1);
    const t = birds.length === 1 ? 1 : (1 - i / denominator);
    const scale = isFinite(t) ? scales.min + (scales.max - scales.min) * t : 1;
    // Guard against invalid scales
    const long = entry.w >= entry.h ? entry.w : entry.h;
    const k = (TARGET_LONG_EDGE_PX * scale) / long;
    const pxW = Math.round(entry.w * k);
    const pxH = Math.round(entry.h * k);

    // Project mask into occupancy cells.
    const mh = entry.mask.length;
    const mw = entry.mask[0]?.length ?? 0;
    if (!mw || !mh) return;
    const cellW = Math.max(1, Math.ceil(pxW / CELL_PX));
    const cellH = Math.max(1, Math.ceil(pxH / CELL_PX));
    const cells: { x: number; y: number }[] = [];
    for (let cy = 0; cy < cellH; cy++) {
      for (let cx = 0; cx < cellW; cx++) {
        // Sample the mask at the cell centre
        const mx = Math.min(mw - 1, Math.floor(((cx + 0.5) / cellW) * mw));
        const my = Math.min(mh - 1, Math.floor(((cy + 0.5) / cellH) * mh));
        if (entry.mask[my][mx]) cells.push({ x: cx, y: cy });
      }
    }
    if (cells.length === 0) return;
    prepared.push({ bird, entry, src, cells, cellW, cellH, pxW, pxH });
  });

  function fits(cellCol: number, cellRow: number, p: Prepared): boolean {
    if (cellCol < 0 || cellRow < 0) return false;
    if (cellCol + p.cellW >= cols || cellRow + p.cellH >= rows) return false;
    for (const c of p.cells) {
      const idx = (cellRow + c.y) * cols + (cellCol + c.x);
      if (occ[idx]) return false;
    }
    return true;
  }

  function mark(cellCol: number, cellRow: number, p: Prepared) {
    for (const c of p.cells) {
      const idx = (cellRow + c.y) * cols + (cellCol + c.x);
      occ[idx] = 1;
    }
  }

  // Place: featured first at centre, then spiral-search outward for each.
  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];
    const featured = i === 0 || p.bird.__featured;
    // We anchor by the bird's centre; convert that to top-left.
    const anchorCellCol = centreCol - Math.floor(p.cellW / 2);
    const anchorCellRow = centreRow - Math.floor(p.cellH / 2);

    let placedCell: { c: number; r: number } | null = null;

    if (featured && fits(anchorCellCol, anchorCellRow, p)) {
      placedCell = { c: anchorCellCol, r: anchorCellRow };
    } else {
      // Spiral search outward
      for (let radius = 0; radius <= SPIRAL_MAX_RADIUS && !placedCell; radius += SPIRAL_STEP) {
        // Sample positions on the perimeter of the radius square
        const samples = Math.max(4, radius * 8);
        for (let s = 0; s < samples; s++) {
          const theta = (s / samples) * Math.PI * 2;
          const dc = Math.round(Math.cos(theta) * radius);
          const dr = Math.round(Math.sin(theta) * radius);
          const c = anchorCellCol + dc;
          const r = anchorCellRow + dr;
          if (fits(c, r, p)) {
            placedCell = { c, r };
            break;
          }
        }
      }
    }
    if (!placedCell) continue;

    mark(placedCell.c, placedCell.r, p);
    placed.push({
      rowid: p.bird.rowid,
      sci: p.bird.sci_name,
      com: p.bird.com_name,
      src: p.src,
      x: placedCell.c * CELL_PX,
      y: placedCell.r * CELL_PX,
      w: p.pxW,
      h: p.pxH,
    });
  }

  return placed;
}

function sciToSlug(sci: string): string {
  return sci.toLowerCase().trim().replace(/\s+/g, "-");
}

// --- Component --------------------------------------------------------------

export default function CollageView({
  window: win,
  enrichment,
  onSelect,
}: {
  window: Window;
  enrichment: EnrichmentMap;
  onSelect: (sci: string) => void;
}) {
  // Show every species detected in the window (capped at the Pi API max of
  // 100). Only species with a cutout get placed; the rest are simply omitted.
  const { data: topData, loading, error } = useFetch<TopSpecies[]>(
    `/api/stats/top-species?window=${win}&limit=100`
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        // Reserve a vertical envelope so the collage feels grounded; tall
        // viewports look weird at extreme heights.
        const h = Math.min(cr.height, Math.max(640, Math.round(cr.width * 0.85)));
        setVp({ w: Math.floor(cr.width), h: Math.floor(h) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Resolve a static URL for the cutout PNG. We ship cutouts under
  // public/birds/<slug>.png so they're served by Vercel's edge.
  const resolveImg = (sci: string): string | null => {
    const slug = sciToSlug(sci);
    return CUTOUTS[slug] ? `/birds/${slug}.png` : null;
  };

  // Convert TopSpecies[] to Detected[] for the collage
  // Sort by count (most detected = featured at center)
  const detections: Detected[] = useMemo(() => {
    if (!topData) return [];
    const sorted = [...topData].sort((a, b) => b.count - a.count);
    // Mark first one as featured (hack: add property via type assertion)
    if (sorted.length > 0) {
      (sorted[0] as TopSpecies & { __featured?: boolean }).__featured = true;
    }
    return sorted.map((s, i) => ({
      rowid: -i,
      sci_name: s.sci_name,
      com_name: s.com_name,
      confidence: 1,
      date: "",
      time: "",
      timestamp: "",
      recording_url: "",
    }));
  }, [topData]);

  const placements = useMemo(() => {
    if (!detections?.length) return [];
    // Use measured viewport width, or a reasonable default
    // For desktop, 1024 is a good default that matches typical desktop width
    const maxContentW = 1280;
    const effectiveW = vp.w > 10 ? Math.min(vp.w, maxContentW) : 1024;  // Default to 1024, not 400
    const effectiveH = vp.h > 10 ? vp.h : 640;
    
    const placed = placeBirds(detections, effectiveW, effectiveH, resolveImg);
    if (placed.length === 0) return placed;
    
    // Calculate bounding box and center the content
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of placed) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.w);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + p.h);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const offsetX = (effectiveW - contentW) / 2 - minX;
    const offsetY = (effectiveH - contentH) / 2 - minY;
    
    return placed.map(p => ({
      ...p,
      x: p.x + offsetX,
      y: p.y + offsetY,
    }));
  }, [detections, vp.w, vp.h]);

  if (loading && !topData) return <LoadingGrid />;
  if (error) return <ErrorState message={error} />;
  if (!topData || topData.length === 0)
    return <EmptyState message="No detections in this window yet." />;
  if (placements.length === 0)
    return (
      <EmptyState message={`Could not render collage. Showing ${topData.length} species. Check back soon.`} />
    );

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-5xl mx-auto overflow-visible"
      style={{ height: Math.max(vp.h, 400) }}
    >
      {placements.map((p) => {
        // resolveSpecies is here for future enrichment lookups (links, etc).
        resolveSpecies(enrichment, p.sci);
        const label = p.com;
        return (
          <button
            key={p.rowid}
            onClick={() => onSelect(p.sci)}
            title={label}
            className="absolute select-none transition-transform duration-200 hover:z-10 hover:scale-[1.04]"
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.src}
              alt={label}
              width={p.w}
              height={p.h}
              draggable={false}
              className="h-full w-full object-contain"
              style={{ imageRendering: "auto" }}
            />
          </button>
        );
      })}
    </div>
  );
}
