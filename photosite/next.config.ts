import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gallery images are arbitrary client-supplied URLs (R2, Unsplash, their own
  // CDN), so the generated sites use plain <img> with explicit sizes rather
  // than next/image. Nothing here needs remote patterns.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
