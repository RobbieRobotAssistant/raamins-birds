"use client";

import { useEffect } from "react";

import CollageView from "@/components/CollageView";

/**
 * Chrome-less collage page built for the MagicMirror display.
 *
 * Renders ONLY the default 24-hour spiral collage (the same `CollageView`
 * component the main site uses) on a TRANSPARENT background, so the bird
 * cutouts float directly over the mirror. Deliberately isolated from the main
 * site — no header, tabs, footer, or hover card — and consumed via an <iframe>
 * by the MagicMirror module, which reloads it once an hour.
 */
export default function MirrorPage() {
  useEffect(() => {
    // The global stylesheet paints html/body the "paper" color. Override to
    // transparent for this page only so the iframe shows the mirror behind the
    // floating cutouts. Restore on unmount.
    const root = document.documentElement;
    const prev = {
      htmlBg: root.style.background,
      bodyBg: document.body.style.background,
      bodyMargin: document.body.style.margin,
    };
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
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
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {/* 24h = the site default. onSelect is a no-op (no interaction on the mirror). */}
      <CollageView window="24h" onSelect={() => {}} />
    </main>
  );
}
