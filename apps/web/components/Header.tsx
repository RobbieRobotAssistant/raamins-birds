"use client";

import type { Window } from "@/lib/types";
import { WINDOWS } from "@/lib/params";

export type View = "collage" | "stats" | "atlas";

const TITLE = "raamin's birds";
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
  scrolled,
}: {
  location: string;
  view: View;
  setView: (v: View) => void;
  window: Window;
  setWindow: (w: Window) => void;
  scrolled: boolean;
}) {
  return (
    <header
      className={`sticky top-0 z-30 bg-paper transition-shadow duration-300 ${
        scrolled ? "shadow-[0_2px_14px_rgba(20,18,15,0.07)]" : ""
      }`}
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        {/* Masthead — collapses away on scroll */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            scrolled ? "max-h-0 opacity-0" : "max-h-52 opacity-100"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-9">
            <h1 className="serif text-4xl font-normal lowercase tracking-tight">
              {TITLE}
            </h1>
            {location && <span className="chrome">{location}</span>}
          </div>
          <p className="mt-2 max-w-prose pb-1 text-sm leading-relaxed text-muted">
            an autonomous listening station identifying birds by sound, around
            the clock. every entry below is a real detection.
          </p>
        </div>

        {/* Bar — nav + window selector, always visible */}
        <div className="flex flex-wrap items-center justify-between gap-y-3 py-3">
          <div className="flex items-center gap-5">
            {scrolled && (
              <span className="serif hidden text-lg lowercase tracking-tight text-ink sm:inline">
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
    </header>
  );
}
