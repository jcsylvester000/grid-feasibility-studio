import type { MetadataRoute } from "next";

const pages = ["/", "/feasibility-study", "/how-it-works", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  return pages.map((p) => ({
    url: `${origin}${p === "/" ? "" : p}`,
    changeFrequency: "monthly",
    priority: p === "/" ? 1 : p === "/terms" || p === "/privacy" ? 0.3 : 0.7,
  }));
}
