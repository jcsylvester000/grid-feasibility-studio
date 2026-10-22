/**
 * Options and field dictionary per product (BRD S-03: "Options come from GET /api/options, generated
 * from the field dictionary, so new dropdown values need no code change").
 * Source data: lib/options/catalog/*.json, copied from the prototype's generated dictionaries
 * (node_io.schema.json#/$defs/FieldDictionary). Edit those JSON files to add or rename options.
 */
import type { Product } from "@/lib/db/schema";
import executiveSummary from "./catalog/executive_summary.json";
import feasibilityReport from "./catalog/feasibility_report.json";
import locations from "./catalog/locations.json";
import quickReport from "./catalog/quick_report.json";

export const OPTIONS_VERSION = "2026-10-19";

export type FieldOption = {
  value: string | number | boolean;
  label: string;
  group?: string;
  maps_to?: { low?: number | null; base?: number | null; high?: number | null; unit?: string; canonical?: string; approximate?: boolean };
  means_unknown?: boolean;
};

export type FieldEntry = {
  key: string;
  label: string;
  type: "choice" | "multi_choice" | "number" | "range" | "text" | "boolean" | "date" | "file" | "location" | "other";
  meaning?: string;
  unit?: string;
  capability?: string;
  provider_tag?: "can" | "idea" | "cant" | "system";
  who_provides?: string;
  options?: FieldOption[];
  [k: string]: unknown;
};

export type LocationTree = Record<string, Record<string, string[]>>;

const dictionaries: Partial<Record<Product, FieldEntry[]>> = {
  quick_report: quickReport as FieldEntry[],
  executive_summary: executiveSummary as FieldEntry[],
  feasibility_report: feasibilityReport as FieldEntry[],
  // teaser_intake: its fields (files, pasted text, relationship) are added in batch B7.
};

/** The field dictionary sent to the pipeline inside every RunRequest (VS-02). */
export function fieldDictionary(product: Product): FieldEntry[] {
  return dictionaries[product] ?? [];
}

export function getOptions(product: Product) {
  return {
    product,
    version: OPTIONS_VERSION,
    fields: fieldDictionary(product),
    locations: locations as LocationTree,
  };
}

export const locationTree = () => locations as LocationTree;
