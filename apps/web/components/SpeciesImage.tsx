"use client";

import { useState } from "react";

import type { ResolvedSpecies } from "@/lib/format";

// Renders the species illustration, or a common-name text placeholder when no
// image is available (or the image fails to load). resolveSpecies optimistically
// points at /birds/<slug>.png; if that cutout doesn't exist yet, the <img>
// errors and we fall back to the placeholder instead of showing a broken icon.
// The placeholder is the signal that a cutout still needs to be made.
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
  // Track the src that failed, so switching species (new src) retries cleanly.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = resolved.imageUrl && failedSrc !== resolved.imageUrl;

  if (showImage) {
    return (
      <div className={`relative overflow-hidden bg-[#ece8dd] ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.imageUrl}
          alt={comName}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setFailedSrc(resolved.imageUrl ?? null)}
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
