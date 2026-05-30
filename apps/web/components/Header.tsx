"use client";

import { useEffect, useRef, useState } from "react";

import type { Window } from "@/lib/types";
import { WINDOWS } from "@/lib/params";

export type View = "collage" | "stats" | "atlas";

const TITLE = "Raamin's birds";
const VIEWS: View[] = ["collage", "stats", "atlas"];
const WINDOW_LABEL: Record<Window, string> = {
  "1h": "1h",
  "12h": "12h",
  "24h": "24h",
  "7d": "7d",
  all: "all",
};

export default function Header({
  location,
  view,
  setView,
  window,
  setWindow,
}: {
  location: string;
  view: View;
  setView: (v: View) => void;
  window: Window;
  setWindow: (w: Window) => void;
}) {
  // "stuck" = the masthead has scrolled past and the bar is pinned. Detected
  // with an IntersectionObserver on a sentinel — fires once per crossing, so
  // (unlike a scrollY threshold) it can't oscillate when layout shifts.
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* Masthead — in normal flow, scrolls away */}
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-9">
          <h1 className="serif text-4xl font-normal tracking-tight">{TITLE}</h1>
          {location && <span className="chrome">{location}</span>}
        </div>
        <p className="mt-2 max-w-prose pb-3 text-sm leading-relaxed text-muted">
          an autonomous listening station identifying birds by sound, around the
          clock. every entry below is a real detection.
        </p>
      </div>

      {/* Sentinel — marks where the bar begins to stick */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Bar — nav + window selector, sticks to the top of the viewport */}
      <div
        className={`sticky top-0 z-30 bg-paper transition-shadow duration-300 ${
          stuck ? "shadow-[0_2px_14px_rgba(20,18,15,0.07)]" : ""
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-3 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-5">
            {stuck && (
              <span className="serif hidden text-lg tracking-tight text-ink sm:inline">
                {TITLE}
              </span>
            )}
            <nav className="flex gap-5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-current={view === v}
                  className={`chrome !text-[0.8125rem] transition-colors ${
                    view === v
                      ? "text-ink underline underline-offset-[6px]"
                      : "hover:text-ink"
                  }`}
                >
                  {v}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1 rounded-sm border hairline p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-2.5 py-1 font-mono text-[0.6875rem] lowercase tracking-wider transition-colors ${
                  window === w ? "bg-ink text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {WINDOW_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
