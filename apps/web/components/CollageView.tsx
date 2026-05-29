"use client";

import { useFetch } from "@/lib/useFetch";
import { confidencePct, resolveSpecies, timeAgo } from "@/lib/format";
import type { Detection, EnrichmentMap, Window } from "@/lib/types";
import SpeciesImage from "./SpeciesImage";
import { EmptyState, ErrorState, LoadingGrid } from "./States";

export default function CollageView({
  window,
  enrichment,
  onSelect,
}: {
  window: Window;
  enrichment: EnrichmentMap;
  onSelect: (sci: string) => void;
}) {
  const { data, loading, error } = useFetch<Detection[]>(
    `/api/detections?window=${window}`
  );

  if (loading && !data) return <LoadingGrid />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No detections in this window yet." />;

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4">
      {data.map((d) => {
        const r = resolveSpecies(enrichment, d.sci_name);
        return (
          <button
            key={d.rowid}
            onClick={() => onSelect(d.sci_name)}
            className="group text-left"
          >
            <SpeciesImage
              resolved={r}
              comName={d.com_name}
              showAiBadge
              className="aspect-square w-full"
            />
            <div className="mt-2">
              <div className="serif text-[0.95rem] leading-tight group-hover:underline group-hover:underline-offset-2">
                {d.com_name}
              </div>
              <div className="font-mono text-[0.7rem] italic text-muted">
                {d.sci_name}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="label">{timeAgo(d.timestamp)}</span>
                <span className="label">{confidencePct(d.confidence)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
