"use client";

import { useEffect, useState } from "react";

import { useFetch } from "@/lib/useFetch";
import {
  clockTime,
  confidencePct,
  resolveSpecies,
  shortDate,
} from "@/lib/format";
import type { EnrichmentMap, SpeciesDetail, Window } from "@/lib/types";
import SpeciesImage from "./SpeciesImage";
import ReportModal from "./ReportModal";

const WINDOW_LABEL: Record<Window, string> = {
  "1h": "last hour",
  "12h": "last 12h",
  "24h": "last 24h",
  "7d": "last 7 days",
  all: "all time",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="serif mt-0.5 text-xl tabular-nums">{value}</div>
    </div>
  );
}

export default function SpeciesModal({
  sci,
  window,
  enrichment,
  onClose,
}: {
  sci: string;
  window: Window;
  enrichment: EnrichmentMap;
  onClose: () => void;
}) {
  const { data, loading, error } = useFetch<SpeciesDetail>(
    `/api/species/detail?sci=${encodeURIComponent(sci)}&window=${window}`
  );
  const r = resolveSpecies(enrichment, sci);
  const [reporting, setReporting] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-paper shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 font-mono text-sm text-muted hover:text-ink"
        >
          ✕ esc
        </button>

        <div className="grid sm:grid-cols-[40%_1fr]">
          <SpeciesImage
            resolved={r}
            comName={data?.com_name ?? sci}
            showAiBadge
            className="aspect-square w-full sm:aspect-auto sm:h-full sm:min-h-[16rem]"
          />

          <div className="p-6">
            {error ? (
              <p className="label">could not load · {error}</p>
            ) : !data && loading ? (
              <p className="label">loading…</p>
            ) : !data ? (
              <p className="label">no data</p>
            ) : (
              <>
                <h2 className="serif text-2xl leading-tight">
                  {data.com_name}
                </h2>
                <p className="font-mono text-sm italic text-muted">
                  {data.sci_name}
                </p>
                <p className="label mt-1">genus · {r.genus || "—"}</p>

                <div className="mt-5 grid grid-cols-3 gap-3 border-y hairline py-4">
                  <Stat label="all-time" value={String(data.all_time_count)} />
                  <Stat
                    label={WINDOW_LABEL[window]}
                    value={String(data.window_count)}
                  />
                  <Stat
                    label="first heard"
                    value={shortDate(data.first_heard)}
                  />
                </div>

                <div className="mt-5">
                  <h3 className="label mb-2">recent recordings</h3>
                  {data.recent.length === 0 ? (
                    <p className="label">none</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.recent.slice(0, 5).map((rec) => (
                        <li key={rec.rowid} className="flex items-center gap-2">
                          <span className="label w-24 shrink-0">
                            {clockTime(rec.timestamp)} ·{" "}
                            {confidencePct(rec.confidence)}
                          </span>
                          <audio
                            controls
                            preload="none"
                            src={`/api/audio/${rec.rowid}`}
                            className="h-8 w-full"
                          />
                          <button
                            onClick={() => setReporting(rec.rowid)}
                            title="report this recording"
                            aria-label="report this recording"
                            className="shrink-0 text-muted transition-colors hover:text-accent"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <circle cx="12" cy="12" r="9" />
                              <line x1="12" y1="7.5" x2="12" y2="13" />
                              <line x1="12" y1="16.5" x2="12" y2="16.5" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-5">
                  <h3 className="label mb-1.5">about</h3>
                  <p className="text-sm leading-relaxed text-ink/90">
                    {r.wikiSummary ?? (
                      <span className="text-muted">
                        Description not yet available. Use the reference links
                        below.
                      </span>
                    )}
                  </p>
                </div>

                <div className="mt-5 flex gap-4">
                  <a
                    href={r.wikiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="label !text-[0.75rem] text-ink underline underline-offset-4 hover:text-accent"
                  >
                    wikipedia ↗
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {reporting !== null && data && (
      <ReportModal
        rowid={reporting}
        comName={data.com_name}
        sciName={data.sci_name}
        onClose={() => setReporting(null)}
      />
    )}
    </>
  );
}
