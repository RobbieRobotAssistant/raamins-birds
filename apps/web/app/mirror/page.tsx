"use client";

import { useEffect, useState } from "react";

import CollageView from "@/components/CollageView";

/**
 * Chrome-less collage page built for the MagicMirror display.
 *
 * Renders the default 24-hour spiral collage (the same `CollageView` the main
 * site uses) on a TRANSPARENT background, with a centered caption beneath it,
 * so the cutouts + text float over the mirror. Isolated from the main site —
 * no header, tabs, footer, or hover card — and embedded via <iframe> by the
 * MagicMirror module (reloaded hourly).
 *
 * The caption defaults to the text below but can be overridden (or hidden) with
 * a `?caption=` query param, e.g. /mirror?caption=Hello — so the wording can be
 * changed from the mirror config without redeploying.
 */
const DEFAULT_CAPTION = "Check out all the friends who visited us today";

export default function MirrorPage() {
  const [caption, setCaption] = useState(DEFAULT_CAPTION);

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

    // Optional caption override via ?caption= (empty value hides it).
    const param = new URLSearchParams(window.location.search).get("caption");
    if (param !== null) setCaption(param);

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
      {caption ? (
        <div
          style={{
            marginTop: "4px",
            textAlign: "center",
            color: "#d8d8d8",
            fontFamily:
              '"Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontWeight: 300,
            fontSize: "22px",
            letterSpacing: "0.4px",
            padding: "0 16px",
          }}
        >
          {caption}
        </div>
      ) : null}
    </main>
  );
}
