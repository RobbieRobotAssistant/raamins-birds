import type { Metadata } from "next";
import { Newsreader } from "next/font/google";

import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });

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
    <html lang="en" className={newsreader.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
