import type { Metadata } from "next";

import "./globals.css";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Garden Birds";

export const metadata: Metadata = {
  title: `${siteName} — bird detections`,
  description:
    "A public log of birds detected in the garden, by an autonomous BirdNET-Pi listening station.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
