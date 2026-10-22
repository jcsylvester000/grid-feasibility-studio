import type { Product } from "@/lib/db/schema";
import { getOptions } from "@/lib/options";
import type { FormDefinition, Intake, ValidationResult } from "./types";
import { FORM_DEFINITIONS, VALIDATORS } from "./validators";

/** Form definitions per product. The Teaser Scan form arrives in batch B7. */
export const FORMS: Partial<Record<Product, FormDefinition>> = FORM_DEFINITIONS;

export function validateIntake(product: Product, intake: Intake): ValidationResult | null {
  const v = VALIDATORS[product];
  return v ? v(intake, getOptions(product)) : null;
}

/** Default answers for a new draft (the Feasibility Report starts summary-first, as GRID's sample). */
export const DEFAULT_INTAKE: Partial<Record<Product, Intake>> = { feasibility_report: { toc_mode: "summary_first" } };

/** Short location label for titles, e.g. "Taguig". */
export function locationLabel(intake: Intake) {
  return typeof intake["property.city"] === "string" ? (intake["property.city"] as string) : null;
}
