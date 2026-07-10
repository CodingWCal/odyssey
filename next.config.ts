import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in the user profile dir
  // otherwise makes Turbopack guess the wrong root (multiple-lockfiles warning).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
