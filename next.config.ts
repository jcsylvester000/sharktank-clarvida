import type { NextConfig } from "next";

// Static export: the whole prototype runs from plain files (Netlify, or `npm start` locally, offline).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
