import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });
// IBM Plex Mono — the site's monospace for labels/chrome (nav, selectors,
// timestamps, scientific names). Italics loaded for the scientific names.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Raamin's Birds",
  description:
    "A public log of birds detected in the garden, by an autonomous BirdNET-Pi listening station.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
