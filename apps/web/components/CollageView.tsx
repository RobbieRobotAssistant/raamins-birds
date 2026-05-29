"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useFetch } from "@/lib/useFetch";
import type { Detection, TopSpecies, Window } from "@/lib/types";
import { EmptyState, ErrorState, LoadingGrid } from "./States";
import { CUTOUTS, type CutoutEntry } from "@/lib/cutouts.generated";

/**
 * Raster-bitmask spiral-pack collage (responsive).
 *
 * Birds are packed from the centre outward, nesting into each other's
 * silhouettes via per-species alpha masks. The packing canvas WIDTH is bound to
 * the viewport bucket, so the cluster goes portrait on phones and landscape on
 * desktop. A final scale-to-fit step makes the cluster exactly fill the measured
 * width and caps its height. Packing is keyed on the breakpoint bucket, so the
 * arrangement only re-flows when crossing mobile/tablet/desktop — not on every
 * resize pixel (scale-to-fit absorbs minor width changes cheaply).
 */

const CELL_PX = 8;

type Bucket = "m" | "t" | "d";

// Per-breakpoint base bird size (long edge, px) + per-recency scale range.
function bucketConfig(bucket: Bucket): {
  base: number;
  scaleMin: number;
  scaleMax: number;
} {
  if (bucket === "m") return { base: 105, scaleMin: 0.72, scaleMax: 1.0 };
  if (bucket === "t") return { base: 140, scaleMin: 0.74, scaleMax: 1.08 };
  return { base: 170, scaleMin: 0.78, scaleMax: 1.18 };
}

// Representative canvas width the arrangement is packed at (scale-to-fit then
// adapts it to the real measured width).
function bucketWidth(bucket: Bucket): number {
  if (bucket === "m") return 390;
  if (bucket === "t") return 760;
  return 1024;
}

type Placed = {
  rowid: number;
  sci: string;
  com: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Detected = Detection;

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

// Pack birds into a width-bounded canvas; returns placements normalized to the
// cluster's bounding box, plus the bbox size (reference px).
function packBirds(
  birds: Detected[],
  canvasWidthPx: number,
  cfg: { base: number; scaleMin: number; scaleMax: number }
): PackResult {
  const empty: PackResult = { placed: [], width: 0, height: 0 };
  if (canvasWidthPx < 50 || birds.length === 0) return empty;

  const cols = Math.max(8, Math.floor(canvasWidthPx / CELL_PX));
  const rows = Math.max(cols, birds.length * 14);
  const occ = new Uint8Array(cols * rows);
  const centreCol = Math.floor(cols / 2);
  const centreRow = Math.floor(rows / 2);

  type Prepared = {
    bird: Detected;
    src: string;
    cells: { x: number; y: number }[];
    cellW: number;
    cellH: number;
    pxW: number;
    pxH: number;
  };
  const prepared: Prepared[] = [];

  birds.forEach((bird, i) => {
    const entry: CutoutEntry | undefined = CUTOUTS[sciToSlug(bird.sci_name)];
    const src = resolveImg(bird.sci_name);
    if (!entry || !src) return; // skip species without a cutout

    // Newer/most-detected (lower index) render larger.
    const denom = Math.max(1, birds.length - 1);
    const t = birds.length === 1 ? 1 : 1 - i / denom;
    const scale = cfg.scaleMin + (cfg.scaleMax - cfg.scaleMin) * t;
    const long = Math.max(entry.w, entry.h);
    let k = (cfg.base * scale) / long;
    k = Math.min(k, (canvasWidthPx * 0.9) / entry.w); // never exceed canvas
    const pxW = Math.max(1, Math.round(entry.w * k));
    const pxH = Math.max(1, Math.round(entry.h * k));

    const mh = entry.mask.length;
    const mw = entry.mask[0]?.length ?? 0;
    if (!mw || !mh) return;
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
    if (cells.length) prepared.push({ bird, src, cells, cellW, cellH, pxW, pxH });
  });

  const fits = (col: number, row: number, p: Prepared): boolean => {
    if (col < 0 || row < 0) return false;
    if (col + p.cellW >= cols || row + p.cellH >= rows) return false;
    for (const c of p.cells) {
      if (occ[(row + c.y) * cols + (col + c.x)]) return false;
    }
    return true;
  };
  const mark = (col: number, row: number, p: Prepared) => {
    for (const c of p.cells) occ[(row + c.y) * cols + (col + c.x)] = 1;
  };

  const maxRadius = Math.max(cols, rows);
  const placed: Placed[] = [];

  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];
    const anchorCol = centreCol - Math.floor(p.cellW / 2);
    const anchorRow = centreRow - Math.floor(p.cellH / 2);
    let spot: { c: number; r: number } | null = null;

    if (i === 0 && fits(anchorCol, anchorRow, p)) {
      spot = { c: anchorCol, r: anchorRow };
    } else {
      for (let radius = 0; radius <= maxRadius && !spot; radius += 1) {
        const samples = Math.max(4, radius * 8);
        for (let s = 0; s < samples; s++) {
          const theta = (s / samples) * Math.PI * 2;
          const c = anchorCol + Math.round(Math.cos(theta) * radius);
          const r = anchorRow + Math.round(Math.sin(theta) * radius);
          if (fits(c, r, p)) {
            spot = { c, r };
            break;
          }
        }
      }
    }
    if (!spot) continue;
    mark(spot.c, spot.r, p);
    placed.push({
      rowid: p.bird.rowid,
      sci: p.bird.sci_name,
      com: p.bird.com_name,
      src: p.src,
      x: spot.c * CELL_PX,
      y: spot.r * CELL_PX,
      w: p.pxW,
      h: p.pxH,
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

  const detections = useMemo<Detected[]>(() => {
    if (!topData) return [];
    return [...topData]
      .sort((a, b) => b.count - a.count)
      .map((s, i) => ({
        rowid: -i - 1,
        sci_name: s.sci_name,
        com_name: s.com_name,
        confidence: 1,
        date: "",
        time: "",
        timestamp: "",
        recording_url: "",
      }));
  }, [topData]);

  // Arrangement: re-pack only on species-set or breakpoint change.
  const pack = useMemo<PackResult | null>(() => {
    if (!detections.length || !measured) return null;
    return packBirds(detections, bucketWidth(bucket), bucketConfig(bucket));
  }, [detections, bucket, measured]);

  // Scale the packed cluster to fit the measured width; cap height at 85vh.
  const layout = useMemo(() => {
    if (!pack || pack.placed.length === 0) return null;
    const avail = Math.min(measuredW, 1024);
    const maxH = viewportH * 0.85;
    const scale = Math.min(avail / pack.width, maxH / pack.height, 1);
    return {
      scale,
      contentH: pack.height * scale,
      offsetX: (avail - pack.width * scale) / 2,
    };
  }, [pack, measuredW, viewportH]);

  return (
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
              key={p.rowid}
              onClick={() => onSelect(p.sci)}
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
  );
}
