/**
 * Generic form validation (BRD S-03 rule 3: "Generate is enabled when the product's required inputs
 * pass validation"). Shared by the client form and the server (PATCH is lenient; runs validate).
 * Unknown keys and hidden fields are dropped from the cleaned intake.
 */
import { isRequired, isShown, type FormContext, type FormDefinition, type FormField, type Intake, type Issue, type ValidationResult } from "./types";

export const TEXT_MAX = 200;
export const TEXTAREA_MAX = 5000;
export const NUMBER_MAX = 1e13;

export function choiceOptions(ctx: FormContext, f: FormField, intake: Intake) {
  const entry = ctx.fields.find((x) => x.key === f.key);
  let opts = entry?.options ?? [];
  if (f.groupBy) opts = opts.filter((o) => !o.group || o.group === String(intake[f.groupBy!] ?? ""));
  return opts;
}

export function locationOptions(ctx: FormContext, kind: FormField["kind"], intake: Intake): string[] {
  if (kind === "location.region") return Object.keys(ctx.locations);
  if (kind === "location.province") return Object.keys(ctx.locations[String(intake["property.region"])] ?? {});
  if (kind === "location.city") return ctx.locations[String(intake["property.region"])]?.[String(intake["property.province"])] ?? [];
  return [];
}

const verb = (f: FormField) => (f.kind === "text" || f.kind === "textarea" || f.kind === "number" || f.kind === "date" ? "Enter" : "Choose");

export function validateForm(def: FormDefinition, raw: Intake, ctx: FormContext): ValidationResult {
  const issues: Issue[] = [];
  const intake: Intake = {};
  const add = (f: FormField, step: string, message: string) => issues.push({ key: f.key, label: f.label, step, message });

  for (const step of def.steps) {
    for (const f of step.fields) {
      if (!isShown(f, raw)) continue;
      let v = raw[f.key];
      if (typeof v === "string") v = v.trim();
      const kind = f.kind ?? "choice";
      const empty = v === undefined || v === null || v === "" || (kind === "toggle" && v !== true);
      if (empty) {
        if (kind === "toggle") {
          if (v === false) intake[f.key] = false;
          if (isRequired(f, raw)) add(f, step.key, f.hint ?? `Tick “${f.label}”.`);
        } else if (isRequired(f, raw)) add(f, step.key, `${verb(f)} ${f.label.toLowerCase()}.`);
        continue;
      }
      switch (kind) {
        case "toggle":
          intake[f.key] = true;
          break;
        case "text":
          if (String(v).length > TEXT_MAX) add(f, step.key, `${f.label} must be ${TEXT_MAX} characters or fewer.`);
          else intake[f.key] = String(v);
          break;
        case "textarea":
          if (String(v).length > TEXTAREA_MAX) add(f, step.key, `${f.label} must be ${TEXTAREA_MAX} characters or fewer.`);
          else intake[f.key] = String(v);
          break;
        case "number": {
          const n = Number(v);
          if (!Number.isFinite(n) || n <= 0 || n > NUMBER_MAX) add(f, step.key, `Enter ${f.label.toLowerCase()} as a number above zero.`);
          else intake[f.key] = n;
          break;
        }
        case "date":
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(String(v)))) add(f, step.key, `Enter ${f.label.toLowerCase()} as a date.`);
          else intake[f.key] = String(v);
          break;
        case "location.region":
        case "location.province":
        case "location.city":
          if (!locationOptions(ctx, kind, raw).includes(String(v))) add(f, step.key, `Choose ${f.label.toLowerCase()} from the list.`);
          else intake[f.key] = String(v);
          break;
        default: {
          const opt = choiceOptions(ctx, f, raw).find((o) => String(o.value) === String(v));
          if (!opt) add(f, step.key, `Choose ${f.label.toLowerCase()} from the list.`);
          else intake[f.key] = opt.value;
        }
      }
    }
  }

  for (const c of def.crossChecks ?? []) {
    const a = intake[c.a];
    const b = intake[c.b];
    if (typeof a === "number" && typeof b === "number" && b < a) issues.push({ key: c.b, label: c.label, step: c.step, message: c.message });
  }
  return { ok: issues.length === 0, issues, intake };
}
