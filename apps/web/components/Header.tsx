"use client";

import type { Window } from "@/lib/types";
import { WINDOWS } from "@/lib/params";

export type View = "collage" | "stats" | "atlas";

const VIEWS: View[] = ["collage", "stats", "atlas"];
const WINDOW_LABEL: Record<Window, string> = {
  "1h": "1H",
  "12h": "12H",
  "24h": "24H",
  "7d": "7D",
  all: "ALL",
};

export default function Header({
  siteName,
  location,
  view,
  setView,
  window,
  setWindow,
}: {
  siteName: string;
  location: string;
  view: View;
  setView: (v: View) => void;
  window: Window;
  setWindow: (w: Window) => void;
}) {
  return (
    <header className="border-b hairline pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="serif text-3xl font-normal tracking-tight">
          {siteName}
        </h1>
        {location && <span className="label">{location}</span>}
      </div>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        An autonomous listening station identifying birds by sound, around the
        clock. Every entry below is a real detection.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-y-3 pb-3">
        <nav className="flex gap-5">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-current={view === v}
              className={`label !text-[0.8125rem] transition-colors ${
                view === v
                  ? "text-ink underline underline-offset-[6px]"
                  : "hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1 rounded-sm border hairline p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-2.5 py-1 font-mono text-[0.6875rem] tracking-wider transition-colors ${
                window === w
                  ? "bg-ink text-paper"
                  : "text-muted hover:text-ink"
              }`}
            >
              {WINDOW_LABEL[w]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
