import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Native or WASM packages stay outside the server bundle.
  serverExternalPackages: ["@node-rs/argon2", "@electric-sql/pglite"],
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
