"use client";

import type { ResolvedSpecies } from "@/lib/format";

// Renders the species illustration, or a common-name text placeholder when no
// image is available yet. The placeholder is intentionally plain: it's the
// signal that an image still needs to be generated/uploaded for this species.
export default function SpeciesImage({
  resolved,
  comName,
  className = "",
  showAiBadge = false,
}: {
  resolved: ResolvedSpecies;
  comName: string;
  className?: string;
  showAiBadge?: boolean;
}) {
  if (resolved.imageUrl) {
    return (
      <div className={`relative overflow-hidden bg-[#ece8dd] ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.imageUrl}
          alt={comName}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {showAiBadge && resolved.imageIsAi && (
          <span className="absolute bottom-1 right-1 bg-paper/85 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-muted">
            AI illustration
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-[#ece8dd] px-3 text-center ${className}`}
    >
      <span className="serif text-balance text-sm leading-snug text-accent">
        {comName}
      </span>
    </div>
  );
}
