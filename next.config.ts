import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * SE-01 security headers. Content Security Policy: same origin plus UploadThing (browser uploads go
 * straight to its ingest hosts; files are read from *.ufs.sh). Next.js App Router writes small inline
 * scripts for hydration, so script-src needs 'unsafe-inline' unless every page were rendered per request
 * with a nonce (that would make the public pages dynamic; judgment, ledger GFS-24). Development also
 * needs 'unsafe-eval' for fast refresh.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.ufs.sh https://utfs.io",
  "font-src 'self'",
  `connect-src 'self' https://*.uploadthing.com https://*.ingest.uploadthing.com https://*.ufs.sh https://utfs.io${dev ? " ws: wss:" : ""}`,
  "media-src 'self' blob: https://*.ufs.sh",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Native or WASM packages stay outside the server bundle.
  serverExternalPackages: ["@node-rs/argon2", "@electric-sql/pglite"],
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
