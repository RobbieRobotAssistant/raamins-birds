"use client";

import { type CSSProperties, useEffect, useState } from "react";

import CollageView from "@/components/CollageView";
import MirrorCaption from "@/components/MirrorCaption";

/**
 * Chrome-less collage page built for the MagicMirror display.
 *
 * Renders the default 24-hour spiral collage (the same `CollageView` the main
 * site uses) on a TRANSPARENT background, with a caption beneath it, so the
 * cutouts + text float over the mirror. Isolated from the main site — no
 * header, tabs, footer, or hover card — and embedded via <iframe> by the
 * MagicMirror module (reloaded hourly).
 *
 * Caption behavior:
 *  - Default (no query param): a rotating, data-driven caption (`MirrorCaption`)
 *    that cycles live stats every 30s.
 *  - `?caption=Some text`: shows that fixed string instead.
 *  - `?caption=` (empty): hides the caption entirely.
 */
const FIXED_CAPTION_STYLE: CSSProperties = {
  marginTop: "4px",
  minHeight: "2.4em",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#d8d8d8",
  fontFamily: '"Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontWeight: 300,
  fontSize: "22px",
  letterSpacing: "0.4px",
  padding: "0 16px",
};

export default function MirrorPage() {
  // null = no override (use rotating captions); string = fixed override.
  const [override, setOverride] = useState<string | null>(null);

  useEffect(() => {
    // Transparent background for this page only (restored on unmount).
    const root = document.documentElement;
    const prev = {
      htmlBg: root.style.background,
      bodyBg: document.body.style.background,
      bodyMargin: document.body.style.margin,
    };
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";

    // Optional fixed caption via ?caption= ("" hides it; absent = rotate).
    setOverride(new URLSearchParams(window.location.search).get("caption"));

    return () => {
      root.style.background = prev.htmlBg;
      document.body.style.background = prev.bodyBg;
      document.body.style.margin = prev.bodyMargin;
    };
  }, []);

  return (
    <main
      style={{
        background: "transparent",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {/* 24h = the site default. onSelect is a no-op (no interaction on the mirror). */}
      <CollageView window="24h" onSelect={() => {}} />
      {override === null ? (
        <MirrorCaption />
      ) : override ? (
        <div style={FIXED_CAPTION_STYLE}>{override}</div>
      ) : null}
    </main>
  );
}
