"use client";

import { useState } from "react";

import { useFetch } from "@/lib/useFetch";
import type { EnrichmentMap, Window } from "@/lib/types";
import Header, { type View } from "./Header";
import CollageView from "./CollageView";
import StatsView from "./StatsView";
import AtlasView from "./AtlasView";
import SpeciesModal from "./SpeciesModal";

export default function BirdApp({
  siteName,
  location,
}: {
  siteName: string;
  location: string;
}) {
  const [view, setView] = useState<View>("collage");
  const [window, setWindow] = useState<Window>("24h");
  const [selectedSci, setSelectedSci] = useState<string | null>(null);

  // Fetched once; held by the Next data cache upstream. Empty map = fallbacks.
  const { data: enrichment } = useFetch<EnrichmentMap>("/api/enrichment");
  const enr = enrichment ?? {};

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
      <Header
        siteName={siteName}
        location={location}
        view={view}
        setView={setView}
        window={window}
        setWindow={setWindow}
      />

      <main className="mt-8">
        {view === "collage" && (
          <CollageView window={window} onSelect={setSelectedSci} />
        )}
        {view === "stats" && (
          <StatsView window={window} onSelect={setSelectedSci} />
        )}
        {view === "atlas" && (
          <AtlasView enrichment={enr} onSelect={setSelectedSci} />
        )}
      </main>

      {selectedSci && (
        <SpeciesModal
          sci={selectedSci}
          window={window}
          enrichment={enr}
          onClose={() => setSelectedSci(null)}
        />
      )}
    </div>
  );
}
