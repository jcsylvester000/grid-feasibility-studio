import type { FieldEntry, LocationTree } from "@/lib/options";
import { finModel, type FinModel } from "./levels";

export type Intake = Record<string, unknown>;

/**
 * Plain-data condition (the definition is passed to the client form, so no functions):
 * a field's value is (not) one of a list, or the financial model is one of a list.
 */
export type Cond = { key: string; in?: (string | number | boolean)[]; notIn?: (string | number | boolean)[] } | { model: FinModel[] };

export type FieldKind =
  | "choice"
  | "location.region"
  | "location.province"
  | "location.city"
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "toggle";

export type FormField = {
  key: string; // field dictionary key, also the intake key
  label: string; // on-screen label (overrides the dictionary label)
  required?: boolean;
  /** Required only when these conditions hold (for example the cost switch is on). */
  requiredWhen?: Cond | Cond[];
  hint?: string;
  /** Show only when every condition holds (hidden fields are not sent). */
  showWhen?: Cond | Cond[];
  kind?: FieldKind; // default "choice"
  unit?: string; // number fields: "sqm", "PHP", "PHP/sqm"
  placeholder?: string;
  /** Choice options filtered to those whose `group` equals the value of this key (use.detail by use). */
  groupBy?: string;
  wide?: boolean; // spans both columns
};

export type FormStep = {
  key: string;
  title: string;
  lede: string;
  fields: FormField[];
  note?: string;
  optional?: boolean;
  /** The step shows the document drop zone above its fields. */
  documents?: boolean;
};

export type FormDefinition = {
  product: string;
  steps: FormStep[];
  /** Extra checks across fields, run after the per-field checks. */
  crossChecks?: { a: string; b: string; message: string; step: string; label: string }[];
};

export type Issue = { key: string; label: string; step: string; message: string };

export type ValidationResult = { ok: boolean; issues: Issue[]; intake: Intake };

export type FormContext = { fields: FieldEntry[]; locations: LocationTree };

const asList = (c?: Cond | Cond[]) => (!c ? [] : Array.isArray(c) ? c : [c]);
const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

export function holds(c: Cond, intake: Intake) {
  if ("model" in c) return c.model.includes(finModel(intake));
  const v = intake[c.key];
  if (c.in) return !isEmpty(v) && c.in.map(String).includes(String(v));
  if (c.notIn) return !isEmpty(v) && !c.notIn.map(String).includes(String(v));
  return !isEmpty(v);
}

export function isShown(f: FormField, intake: Intake) {
  return asList(f.showWhen).every((c) => holds(c, intake));
}

export function isRequired(f: FormField, intake: Intake) {
  if (f.required) return true;
  const conds = asList(f.requiredWhen);
  return conds.length > 0 && conds.every((c) => holds(c, intake));
}
