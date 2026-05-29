/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Species images are served from Vercel Blob (or a local placeholder).
  // We use plain <img> rather than next/image so any image host works without
  // per-store remotePatterns config the deployer would have to maintain.
};

export default nextConfig;
