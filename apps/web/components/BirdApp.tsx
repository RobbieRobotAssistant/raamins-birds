"use client";

import { useState } from "react";

import { useFetch } from "@/lib/useFetch";
import type { EnrichmentMap, Window } from "@/lib/types";
import Header, { type View } from "./Header";
import Footer from "./Footer";
import CollageView from "./CollageView";
import StatsView from "./StatsView";
import AtlasView from "./AtlasView";
import SpeciesModal from "./SpeciesModal";

export default function BirdApp({ location }: { location: string }) {
  const [view, setView] = useState<View>("collage");
  const [window, setWindow] = useState<Window>("24h");
  const [selectedSci, setSelectedSci] = useState<string | null>(null);

  // Fetched once; held by the Next data cache upstream. Empty map = fallbacks.
  const { data: enrichment } = useFetch<EnrichmentMap>("/api/enrichment");
  const enr = enrichment ?? {};

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        location={location}
        view={view}
        setView={setView}
        window={window}
        setWindow={setWindow}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 pt-8 sm:px-8">
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

      <Footer />

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
