import type { FieldEntry, LocationTree } from "@/lib/options";

export type Intake = Record<string, unknown>;

export type FormField = {
  key: string; // field dictionary key, also the intake key
  label: string; // on-screen label (overrides the dictionary label)
  required?: boolean;
  hint?: string;
  /** Show only when another field has a value other than these (hidden fields are not sent). Plain data so
   *  the definition can be passed to the client form. */
  showWhen?: { key: string; notIn: (string | number)[] };
  kind?: "choice" | "location.region" | "location.province" | "location.city";
};

export type FormStep = { key: string; title: string; lede: string; fields: FormField[]; note?: string };

export type FormDefinition = { product: string; steps: FormStep[] };

export type Issue = { key: string; label: string; step: string; message: string };

export type ValidationResult = { ok: boolean; issues: Issue[]; intake: Intake };

export type FormContext = { fields: FieldEntry[]; locations: LocationTree };

export function isShown(f: FormField, intake: Intake) {
  if (!f.showWhen) return true;
  const v = intake[f.showWhen.key];
  return !(v === undefined || v === null || v === "" || f.showWhen.notIn.map(String).includes(String(v)));
}
