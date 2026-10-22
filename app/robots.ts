import type { MetadataRoute } from "next";

/** Previews and *.netlify.app stay out of search until ALLOW_INDEXING=true on the real domain. */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (process.env.ALLOW_INDEXING !== "true") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/design", "/register/recovery-key"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
