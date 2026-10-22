import type { Product } from "@/lib/db/schema";
import { getOptions } from "@/lib/options";
import { quickReportForm, validateQuickReport } from "./quick-report";
import type { FormDefinition, Intake, ValidationResult } from "./types";

/** Form definitions per product. Executive Summary and Feasibility Report arrive in batch B6. */
export const FORMS: Partial<Record<Product, FormDefinition>> = { quick_report: quickReportForm };

export function validateIntake(product: Product, intake: Intake): ValidationResult | null {
  const opts = getOptions(product);
  if (product === "quick_report") return validateQuickReport(intake, opts);
  return null;
}

/** Short location label for titles, e.g. "Taguig". */
export function locationLabel(intake: Intake) {
  return typeof intake["property.city"] === "string" ? (intake["property.city"] as string) : null;
}
