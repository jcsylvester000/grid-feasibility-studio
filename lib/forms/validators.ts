/** Form definitions and validators per product (client-safe: used by the form and the server). */
import { executiveSummaryForm, feasibilityReportForm, validateExecutiveSummary, validateFeasibilityReport } from "./full-reports";
import { quickReportForm, validateQuickReport } from "./quick-report";
import type { FormContext, FormDefinition, Intake, ValidationResult } from "./types";

export const FORM_DEFINITIONS: Record<string, FormDefinition> = {
  quick_report: quickReportForm,
  executive_summary: executiveSummaryForm,
  feasibility_report: feasibilityReportForm,
};

export const VALIDATORS: Record<string, (raw: Intake, ctx: FormContext) => ValidationResult> = {
  quick_report: validateQuickReport,
  executive_summary: validateExecutiveSummary,
  feasibility_report: validateFeasibilityReport,
};
