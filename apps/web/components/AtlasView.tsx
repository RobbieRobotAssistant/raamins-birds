"use client";

import { useState } from "react";

import { useFetch } from "@/lib/useFetch";
import { resolveSpecies, timeAgo } from "@/lib/format";
import type { EnrichmentMap, SpeciesListItem, Sort } from "@/lib/types";
import SpeciesImage from "./SpeciesImage";
import { EmptyState, ErrorState, LoadingRows } from "./States";

const SORTS: Array<{ key: Sort; label: string }> = [
  { key: "count", label: "most heard" },
  { key: "recent", label: "most recent" },
  { key: "alpha", label: "a → z" },
];

export default function AtlasView({
  enrichment,
  onSelect,
}: {
  enrichment: EnrichmentMap;
  onSelect: (sci: string) => void;
}) {
  const [sort, setSort] = useState<Sort>("count");
  const { data, loading, error } = useFetch<SpeciesListItem[]>(
    `/api/species?sort=${sort}`
  );

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <span className="label">sort</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`label !text-[0.75rem] transition-colors ${
              sort === s.key
                ? "text-ink underline underline-offset-4"
                : "hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading && !data ? (
        <LoadingRows />
      ) : !data || data.length === 0 ? (
        <EmptyState message="No species on the life list yet." />
      ) : (
        <ul className="divide-y divide-line border-y hairline">
          {data.map((s) => {
            const r = resolveSpecies(enrichment, s.sci_name);
            return (
              <li key={s.sci_name}>
                <button
                  onClick={() => onSelect(s.sci_name)}
                  className="group flex w-full items-center gap-4 py-3 text-left"
                >
                  <SpeciesImage
                    resolved={r}
                    comName={s.com_name}
                    className="h-12 w-12 shrink-0 !text-[0.6rem]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="serif text-[1.05rem] leading-tight group-hover:underline group-hover:underline-offset-2">
                      {s.com_name}
                    </div>
                    <div className="font-mono text-xs italic text-muted">
                      {s.sci_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums">
                      {s.count}
                    </div>
                    <div className="label">{timeAgo(s.last_heard)}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
