import "server-only";
/**
 * Sample report payloads for the viewer design board and tests: the C6 Calzada–Tipas golden payloads
 * (mock/vectorshift/payloads). "quick_report_teaser" is the Quick Report 1.1 shape with listing_source
 * built from the Teaser Scan golden payload (BRD 6.4).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (name: string) => JSON.parse(readFileSync(path.join(process.cwd(), "mock/vectorshift/payloads", `${name}.json`), "utf8"));

export const SAMPLE_KEYS = ["quick_report", "quick_report_teaser", "executive_summary", "feasibility_report"] as const;
export type SampleKey = (typeof SAMPLE_KEYS)[number];

export function samplePayload(key: SampleKey): { product: "quick_report" | "executive_summary" | "feasibility_report"; payload: Record<string, unknown> } {
  if (key === "quick_report_teaser") {
    const qr = read("quick_report");
    const ti = read("teaser_intake");
    return {
      product: "quick_report",
      payload: {
        ...qr,
        listing_source: {
          intake_id: ti.meta.intake_id,
          files_count: ti.files.length,
          relationship: ti.meta.relationship,
          claims: ti.claims,
          red_flags: ti.red_flags,
          questions_for_seller: ti.questions_for_seller,
        },
      },
    };
  }
  return { product: key, payload: read(key) };
}
