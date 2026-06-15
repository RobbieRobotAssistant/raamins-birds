"use client";

import { useEffect, useState } from "react";

/**
 * Rotating, data-driven caption for the MagicMirror /mirror page.
 *
 * Pulls a few live data points from the public API and cycles through a set of
 * captions every 30 seconds. Data is refreshed every few minutes so the
 * relative-time phrases ("3 minutes ago") stay accurate. Captions for which we
 * have no data are simply skipped.
 */
const ROTATE_MS = 30 * 1000; // advance caption every 30s
const REFRESH_MS = 5 * 60 * 1000; // re-fetch data every 5 min

type TopSpecies = { sci_name: string; com_name: string; count: number };
type Detection = { com_name: string; timestamp: string };
type FirstDetection = { com_name: string; first_heard: string };
type SpeciesItem = { sci_name: string; com_name: string; count: number };
type PeriodBucket = { bucket: string; count: number };

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

// "8–9 AM" or, across noon/midnight, "11 AM–12 PM".
function hourRange(h: number): string {
  const fmt = (x: number) => {
    const isAm = x % 24 < 12;
    let hr = x % 12;
    if (hr === 0) hr = 12;
    return { hr, mer: isAm ? "AM" : "PM" };
  };
  const a = fmt(h);
  const b = fmt(h + 1);
  return a.mer === b.mer
    ? `${a.hr}–${b.hr} ${a.mer}`
    : `${a.hr} ${a.mer}–${b.hr} ${b.mer}`;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function MirrorCaption() {
  const [recent, setRecent] = useState<Detection | null>(null);
  const [newest, setNewest] = useState<FirstDetection | null>(null);
  const [top, setTop] = useState<TopSpecies[] | null>(null);
  const [speciesCount, setSpeciesCount] = useState<number | null>(null);
  const [periods, setPeriods] = useState<PeriodBucket[] | null>(null);
  const [idx, setIdx] = useState(0);
  // Bumped every rotation so relative-time strings recompute against "now".
  const [, setTick] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [d, f, t, sp, pb] = await Promise.all([
        getJson<Detection[]>("/api/detections?window=all"),
        getJson<FirstDetection[]>("/api/stats/first-detections"),
        getJson<TopSpecies[]>("/api/stats/top-species?window=24h&limit=100"),
        getJson<SpeciesItem[]>("/api/species"),
        getJson<PeriodBucket[]>("/api/stats/by-period?window=24h"),
      ]);
      if (!active) return;
      if (d) setRecent(d[0] ?? null);
      if (f) setNewest(f[0] ?? null);
      if (t) setTop(t);
      if (sp) setSpeciesCount(sp.length);
      if (pb) setPeriods(pb);
    };

    load();
    const refresh = setInterval(load, REFRESH_MS);
    const rotate = setInterval(() => {
      setIdx((i) => i + 1);
      setTick((x) => x + 1);
    }, ROTATE_MS);

    return () => {
      active = false;
      clearInterval(refresh);
      clearInterval(rotate);
    };
  }, []);

  // Build the caption list from whatever data is currently available.
  const captions: string[] = [];

  if (recent?.com_name && recent.timestamp) {
    captions.push(
      `Our most recent visitor: ${recent.com_name}, ${relativeTime(recent.timestamp)}`
    );
  }
  if (newest?.com_name && newest.first_heard) {
    captions.push(
      `Our newest feathered friend: ${newest.com_name} — first seen ${relativeTime(newest.first_heard)}`
    );
  }
  if (top && top.length) {
    const t0 = top[0];
    captions.push(
      `Today's most frequent visitor: ${t0.com_name} (${t0.count} ${t0.count === 1 ? "visit" : "visits"})`
    );
    captions.push(
      `${top.length} ${top.length === 1 ? "species has" : "species have"} visited in the last 24 hours`
    );
    const total = top.reduce((sum, s) => sum + s.count, 0);
    captions.push(
      `${total} ${total === 1 ? "detection" : "detections"} in the last 24 hours`
    );
  }
  if (speciesCount && speciesCount > 0) {
    captions.push(
      `${speciesCount} ${speciesCount === 1 ? "species" : "species"} recorded here all-time`
    );
  }
  if (periods && periods.length) {
    const busiest = periods.reduce((m, b) => (b.count > m.count ? b : m));
    const hour = parseInt(busiest.bucket.slice(11, 13), 10);
    if (!Number.isNaN(hour) && busiest.count > 0) {
      captions.push(`Most activity today: ${hourRange(hour)}`);
    }
  }
  if (top && top.length >= 2) {
    const rarest = top[top.length - 1];
    captions.push(
      `Today's rarest visitor: ${rarest.com_name} (${rarest.count === 1 ? "just 1 visit" : `${rarest.count} visits`})`
    );
  }

  const text = captions.length ? captions[idx % captions.length] : "";

  return (
    <div
      style={{
        marginTop: "4px",
        minHeight: "2.4em",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#d8d8d8",
        fontFamily: '"Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontWeight: 300,
        fontSize: "22px",
        letterSpacing: "0.4px",
        padding: "0 16px",
      }}
    >
      {text}
    </div>
  );
}
