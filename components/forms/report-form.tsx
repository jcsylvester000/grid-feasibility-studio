"use client";

/**
 * Step form for a report (BRD S-03). Steps on the left (top on phones), the current step in the centre,
 * a side panel on desktop (input-level meter for the Executive Summary and Feasibility Report, then the
 * answers); last step Review with Edit links and Generate.
 * Every change autosaves after 800 ms (PATCH /api/reports/{id}); an offline banner shows when the
 * browser is offline and changes save on reconnect. Uploads continue between steps and Generate waits
 * for them (BRD 9.1, AC-026).
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DropZone } from "@/components/files/drop-zone";
import { useUploads, type ServerFile, type Uploads } from "@/components/files/use-uploads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FieldEntry, LocationTree } from "@/lib/options";
import { choiceOptions, locationOptions } from "@/lib/forms/engine";
import {
  COVERAGE_TEXT,
  finMissing,
  finModel,
  headlineCostsMissing,
  inputLevel,
  LEVEL_LABELS,
  MODEL_LABEL,
  nextLevelHint,
  reportCoverage,
  summaryCoverage,
  type Coverage,
  type DocSet,
} from "@/lib/forms/levels";
import { isRequired, isShown, type FormField, type FormStep, type Intake, type Issue } from "@/lib/forms/types";
import { VALIDATORS } from "@/lib/forms/validators";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

type Props = {
  reportId: string;
  product: string;
  productName: string;
  steps: FormStep[];
  fields: FieldEntry[];
  locations: LocationTree;
  initialIntake: Intake;
  notAsked: string[];
  titleFor: { prefix: string; fallback: string };
  uploadDriver?: "uploadthing" | "local";
  initialFiles?: ServerFile[];
};

const controlCls =
  "h-11 w-full rounded-lg border border-line-2 bg-white px-3 text-[15px] text-ink disabled:bg-sand disabled:text-muted aria-[invalid=true]:border-bad";

const CAPABILITY_TEXT: Record<string, string> = {
  land_cost: "land cost",
  development_cost: "build cost",
  unit_mix_and_pricing: "area and price or rent",
  timeline: "timeline",
  operating_assumptions: "operating assumptions",
  funding_structure: "funding split",
};

const peso = (v: number) => `₱${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(v)}`;

export function ReportForm(props: Props) {
  const { reportId, steps, fields, locations, product } = props;
  const router = useRouter();
  const [intake, setIntake] = useState<Intake>(props.initialIntake);
  const [stepIndex, setStepIndex] = useState(0);
  const [save, setSave] = useState<SaveState>("idle");
  const [online, setOnline] = useState(true);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const dirty = useRef(false);
  const pending = useRef<Promise<boolean> | null>(null);
  const reviewIndex = steps.length;
  const hasDocuments = steps.some((s) => s.documents);
  const full = product === "executive_summary" || product === "feasibility_report";
  const uploads = useUploads({ reportId, driver: props.uploadDriver ?? "uploadthing", initial: props.initialFiles ?? [] });
  const ctx = useMemo(() => ({ fields, locations }), [fields, locations]);
  const validation = useMemo(() => VALIDATORS[product]!(intake, ctx), [product, intake, ctx]);
  const issuesByKey = useMemo(() => Object.fromEntries(validation.issues.map((i) => [i.key, i])), [validation]);

  const title = useMemo(() => {
    const city = intake["property.city"];
    const province = intake["property.province"];
    const name = typeof intake["property.name"] === "string" && intake["property.name"].trim() ? String(intake["property.name"]).trim() : null;
    if (name) return `${props.titleFor.prefix} · ${name}`.slice(0, 120);
    return city ? `${props.titleFor.prefix} · ${city}${province && province !== city ? `, ${province}` : ""}` : props.titleFor.fallback;
  }, [intake, props.titleFor]);

  const persist = useCallback(async () => {
    if (!navigator.onLine) {
      setSave("offline");
      return false;
    }
    dirty.current = false;
    setSave("saving");
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intake, title }),
      });
      setSave(res.ok ? "saved" : "error");
      return res.ok;
    } catch {
      dirty.current = true;
      setSave(navigator.onLine ? "error" : "offline");
      return false;
    }
  }, [intake, reportId, title]);

  // Autosave 800 ms after the last change.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      pending.current = persist();
    }, 800);
    return () => clearTimeout(t);
  }, [intake, persist]);

  // Offline banner; save on reconnect.
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine && dirty.current) pending.current = persist();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [persist]);

  function setValue(f: FormField, value: string | boolean) {
    const key = f.key;
    dirty.current = true;
    setSave("idle");
    setTouched((t) => ({ ...t, [key]: true }));
    setIntake((prev) => {
      const next: Intake = { ...prev };
      if (value === "" || value === false) {
        if (f.kind === "toggle") next[key] = false;
        else delete next[key];
      } else if (f.kind === "toggle" || f.kind === "number" || f.kind === "text" || f.kind === "date") {
        next[key] = value;
      } else {
        const opt = fields.find((x) => x.key === key)?.options?.find((o) => String(o.value) === value);
        next[key] = opt ? opt.value : value;
      }
      // Cascades: a parent change clears its children.
      if (key === "property.region") {
        delete next["property.province"];
        delete next["property.city"];
      }
      if (key === "property.province") delete next["property.city"];
      if (key === "use.intended_use") delete next["use.detail"];
      return next;
    });
  }

  const labelFor = useCallback(
    (key: string, value: unknown) => {
      const entry = fields.find((f) => f.key === key);
      const opt = entry?.options?.find((o) => String(o.value) === String(value));
      if (opt) return opt.label;
      if (value === true) return "Yes";
      if (value === false) return "No";
      const n = Number(value);
      if (entry?.type === "number" && value !== "" && Number.isFinite(n)) {
        const unit = entry.unit ?? "";
        if (unit === "PHP") return peso(n);
        if (unit.startsWith("PHP/")) return `${peso(n)}/${unit.slice(4)}`;
        return `${new Intl.NumberFormat("en-PH").format(n)}${unit ? ` ${unit}` : ""}`;
      }
      return String(value);
    },
    [fields],
  );

  const stepIssues = (s: FormStep) => validation.issues.filter((i) => i.step === s.key);
  const stepComplete = (s: FormStep) => stepIssues(s).length === 0;
  const stepHasAnswers = (s: FormStep) => s.fields.some((f) => isShown(f, intake) && intake[f.key] !== undefined && intake[f.key] !== false) || (s.documents && uploads.stored > 0);
  const stepDone = (s: FormStep) => stepComplete(s) && (!s.optional || stepHasAnswers(s));

  async function generate() {
    setRunError(null);
    setGenerating(true);
    try {
      if (uploads.busy) throw new Error("Wait for the uploads to finish.");
      if (pending.current) await pending.current;
      if (dirty.current || save === "error" || save === "idle") {
        const ok = await persist();
        if (!ok) throw new Error("Your answers could not be saved. Check your connection and try again.");
      }
      const res = await fetch(`/api/reports/${reportId}/runs`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 202 || res.status === 409) {
        router.push(`/app/reports/${reportId}/run`);
        return;
      }
      throw new Error(body?.error?.message ?? "The report could not be started. Try again.");
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "The report could not be started.");
      setGenerating(false);
    }
  }

  const goTo = (i: number) => {
    setStepIndex(i);
    requestAnimationFrame(() => document.getElementById("step-heading")?.focus());
  };

  const current = steps[stepIndex];

  return (
    <div className="relative space-y-4" data-testid="report-form-client">
      {!online && (
        <p role="status" className="rounded-lg bg-warn-soft px-4 py-2 text-sm text-warn">
          You are offline. Changes will save when you reconnect.
        </p>
      )}
      {uploads.busy && current?.documents !== true && (
        <p role="status" className="rounded-lg bg-info-soft px-4 py-2 text-sm text-info" data-testid="uploads-running">
          Uploads are still running. You can keep going; Generate waits until they finish.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_260px] [&>*]:min-w-0">
        {/* Steps */}
        <nav aria-label="Form steps">
          <ol className="relative flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {[...steps, { key: "review", title: "Review" } as FormStep].map((s, i) => {
              const done = i < reviewIndex ? stepDone(s) : false;
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === stepIndex ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                      i === stepIndex ? "bg-navy text-white" : "bg-white text-ink-2 ring-1 ring-line hover:ring-bronze",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                        done ? "bg-ok text-white" : i === stepIndex ? "bg-gold text-navy" : "bg-sand text-muted",
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span>
                      {s.title}
                      {s.optional && <span className={cn("block text-[10px]", i === stepIndex ? "text-mist" : "text-muted")}>optional</span>}
                    </span>
                    {done && <span className="sr-only"> (complete)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Current step */}
        <section aria-labelledby="step-heading" className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <p className="eyebrow">
              Step {Math.min(stepIndex + 1, reviewIndex + 1)} of {reviewIndex + 1}
            </p>
            <p aria-live="polite" className="h-4 min-w-16 shrink-0 text-right text-xs leading-4 text-muted" data-testid="save-state">
              {save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? "Not saved" : save === "offline" ? "Offline" : ""}
            </p>
          </div>

          {current ? (
            <>
              <h2 id="step-heading" tabIndex={-1} className="mt-2 text-2xl outline-none">
                {current.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{current.lede}</p>
              {current.key === "use" && full && intake["use.intended_use"] !== undefined && (
                <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm" data-testid="fin-model">
                  Financial model: <b>{MODEL_LABEL[finModel(intake)]}</b>
                </p>
              )}
              {current.documents && (
                <div className="mt-5">
                  <DropZone uploads={uploads} />
                </div>
              )}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {current.fields.filter((f) => isShown(f, intake)).map((f, idx) => (
                  <Field
                    key={`${f.key}-${idx}`}
                    f={f}
                    intake={intake}
                    ctx={ctx}
                    issue={touched[f.key] ? issuesByKey[f.key] : undefined}
                    required={isRequired(f, intake)}
                    onChange={(v) => setValue(f, v)}
                    onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                  />
                ))}
              </div>
              {current.key === "costs" && product === "feasibility_report" && intake["fin.enabled"] === true && (
                <CostsStatus missing={finMissing(intake)} />
              )}
              {current.note && <p className="mt-5 rounded-lg bg-sand px-4 py-3 text-sm text-ink-2">{current.note}</p>}
              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
                  Back
                </Button>
                <Button
                  variant="dark"
                  onClick={() => {
                    setTouched((t) => ({ ...t, ...Object.fromEntries(current.fields.map((f) => [f.key, true])) }));
                    if (stepComplete(current)) goTo(stepIndex + 1);
                  }}
                  aria-disabled={!stepComplete(current)}
                  className={cn(!stepComplete(current) && "opacity-60")}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <Review
              product={product}
              steps={steps}
              intake={intake}
              issues={validation.issues}
              labelFor={labelFor}
              goTo={goTo}
              notAsked={props.notAsked}
              onGenerate={generate}
              generating={generating}
              runError={runError}
              uploads={hasDocuments ? uploads : null}
            />
          )}
        </section>

        {/* Side panel */}
        <aside aria-label="Your answers" className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            {full && <LevelMeter product={product} intake={intake} docs={uploads.docs} />}
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">
              <p className="eyebrow">{props.productName}</p>
              <p className="mt-2 text-sm font-medium">{title}</p>
              <dl className="mt-3 space-y-2 text-sm">
                {steps
                  .flatMap((s) => s.fields.filter((f) => isShown(f, intake) && intake[f.key] !== undefined && f.kind !== "toggle"))
                  .map((f, i) => (
                    <div key={`${f.key}-${i}`}>
                      <dt className="text-xs text-muted">{f.label}</dt>
                      <dd className="break-words">{labelFor(f.key, intake[f.key])}</dd>
                    </div>
                  ))}
                {hasDocuments && uploads.stored > 0 && (
                  <div>
                    <dt className="text-xs text-muted">Documents</dt>
                    <dd>{uploads.stored} uploaded</dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs text-muted">{validation.ok ? "Everything required is in." : `Still needed: ${validation.issues.length}`}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field(p: {
  f: FormField;
  intake: Intake;
  ctx: { fields: FieldEntry[]; locations: LocationTree };
  issue?: Issue;
  required: boolean;
  onChange: (v: string | boolean) => void;
  onBlur: () => void;
}) {
  const { f, intake, issue } = p;
  const id = `f-${f.key.replace(/\W/g, "-")}`;
  const kind = f.kind ?? "choice";
  const describedBy = [issue ? `${id}-error` : null, f.hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const value = intake[f.key];
  const common = { id, name: f.key, "aria-invalid": issue ? true : undefined, "aria-describedby": describedBy } as const;

  if (kind === "toggle") {
    return (
      <div className="sm:col-span-2">
        <label htmlFor={id} className="flex items-start gap-3 rounded-lg border border-line bg-cream p-3">
          <input {...common} type="checkbox" className="mt-1 size-4 accent-[var(--color-navy)]" checked={value === true} onChange={(e) => p.onChange(e.target.checked)} />
          <span>
            <span className="block text-sm font-medium">{f.label}</span>
            {f.hint && (
              <span id={`${id}-hint`} className="block text-xs text-muted">
                {f.hint}
              </span>
            )}
          </span>
        </label>
      </div>
    );
  }

  let control: React.ReactNode;
  if (kind === "text" || kind === "number" || kind === "date") {
    const n = kind === "number" && value !== undefined && value !== "" ? Number(value) : NaN;
    control = (
      <>
        <div className="flex">
          <input
            {...common}
            type={kind === "date" ? "date" : kind === "number" ? "number" : "text"}
            inputMode={kind === "number" ? "decimal" : undefined}
            min={kind === "number" ? 0 : undefined}
            step={kind === "number" ? "any" : undefined}
            maxLength={kind === "text" ? 200 : undefined}
            placeholder={f.placeholder}
            className={cn(controlCls, f.unit && "rounded-r-none")}
            value={value === undefined ? "" : String(value)}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onBlur}
          />
          {f.unit && <span className="inline-flex h-11 shrink-0 items-center rounded-r-lg border border-l-0 border-line-2 bg-sand px-2.5 text-xs text-muted">{f.unit}</span>}
        </div>
        {kind === "number" && f.unit?.startsWith("PHP") && Number.isFinite(n) && n > 0 && (
          <p className="text-xs text-muted" aria-hidden>
            = {peso(n)}
          </p>
        )}
      </>
    );
  } else {
    const isLocation = kind.startsWith("location.");
    const opts = isLocation
      ? locationOptions(p.ctx, kind, intake).map((v) => ({ value: v, label: v }))
      : choiceOptions(p.ctx, f, intake).map((o) => ({ value: String(o.value), label: o.label }));
    const blank = opts.find((o) => o.value === "");
    const disabled = kind === "location.province" ? !intake["property.region"] : kind === "location.city" ? !intake["property.province"] : false;
    control = (
      <select {...common} className={controlCls} value={value === undefined ? "" : String(value)} onChange={(e) => p.onChange(e.target.value)} disabled={disabled}>
        <option value="">{disabled ? "Choose the level above first" : (blank?.label ?? "Select…")}</option>
        {opts
          .filter((o) => o.value !== "")
          .map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>
    );
  }

  return (
    <div className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
      <label htmlFor={id} className="block text-sm font-medium">
        {f.label}
        {p.required && <span className="text-bad" aria-hidden> *</span>}
        {p.required && <span className="sr-only"> (required)</span>}
      </label>
      {control}
      {f.hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {f.hint}
        </p>
      )}
      {issue && (
        <p id={`${id}-error`} role="alert" className="text-sm text-bad">
          {issue.message}
        </p>
      )}
    </div>
  );
}

function CostsStatus({ missing }: { missing: string[] }) {
  return missing.length ? (
    <p className="mt-5 rounded-lg bg-warn-soft px-4 py-3 text-sm text-ink" data-testid="costs-status">
      <b>Still needed for L3:</b> {missing.map((m) => CAPABILITY_TEXT[m] ?? m.replace(/_/g, " ")).join(", ")}.
    </p>
  ) : (
    <p className="mt-5 rounded-lg bg-ok-soft px-4 py-3 text-sm text-ink" data-testid="costs-status">
      <b>Complete.</b> The financial engine will run.
    </p>
  );
}

function LevelMeter({ product, intake, docs }: { product: string; intake: Intake; docs: DocSet }) {
  const lv = inputLevel(product, intake, docs);
  const hint = nextLevelHint(product, intake, docs);
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4" data-testid="level-meter">
      <p className="eyebrow">Input level</p>
      <p className="mt-1 font-display text-3xl" data-testid="level-value">
        {lv.label}
      </p>
      <ol className="mt-3 grid grid-cols-5 gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((n) => (
          <li key={n} className={cn("h-1.5 rounded-full", n <= lv.n ? "bg-bronze" : "bg-sand")} />
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">{lv.n >= 0 ? LEVEL_LABELS[lv.n] : "Choose a location to start."}</p>
      {product === "feasibility_report" && <p className="mt-2 text-xs">{lv.n >= 3 ? "A verdict is possible." : "No verdict below L3."}</p>}
      {hint && <p className="mt-2 text-xs text-ink-2">{hint}</p>}
    </div>
  );
}

const COVERAGE_TONE: Record<Coverage, "ok" | "warn" | "bad"> = { complete: "ok", partial: "warn", inputs_required: "bad" };

function Review(p: {
  product: string;
  steps: FormStep[];
  intake: Intake;
  issues: Issue[];
  labelFor: (k: string, v: unknown) => string;
  goTo: (i: number) => void;
  notAsked: string[];
  onGenerate: () => void;
  generating: boolean;
  runError: string | null;
  uploads: Uploads | null;
}) {
  const docs = p.uploads?.docs ?? {};
  const busy = !!p.uploads?.busy;
  const lede =
    p.product === "quick_report"
      ? "Check your answers, then generate. The result is an indicative screen, not a feasibility verdict."
      : "Check your answers, then generate. Anything you left out is listed in the report as a limitation, not guessed.";
  return (
    <div>
      <h2 id="step-heading" tabIndex={-1} className="mt-2 text-2xl outline-none">
        Review
      </h2>
      <p className="mt-1 text-sm text-muted">{lede}</p>

      {p.issues.length > 0 && (
        <div role="alert" className="mt-5 rounded-lg border border-bad/30 bg-bad-soft p-4 text-sm">
          <p className="font-medium text-bad">Still needed before you can generate:</p>
          <ul className="mt-2 space-y-1">
            {p.issues.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center gap-2">
                <span>{i.message}</span>
                <button type="button" className="text-bronze-ink underline" onClick={() => p.goTo(p.steps.findIndex((s) => s.key === i.step))}>
                  Edit<span className="sr-only"> {i.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.product === "executive_summary" && (
        <CoverageList
          title={`What the summary will contain (input level ${inputLevel(p.product, p.intake, docs).label})`}
          rows={summaryCoverage(p.intake, docs).map((r) => ({ label: r.label, coverage: r.coverage }))}
          testId="summary-coverage"
          note={headlineCostsMissing(p.intake).length ? "Add the headline costs to fill the financial projection." : null}
        />
      )}
      {p.product === "feasibility_report" &&
        (() => {
          const c = reportCoverage(p.intake, docs);
          return (
            <CoverageList
              title={`Expected coverage (input level ${inputLevel(p.product, p.intake, docs).label})`}
              rows={[...c.sections.map((s) => ({ label: `${s.number}. ${s.label}`, coverage: s.coverage })), { label: "Financial statements", coverage: c.financials }]}
              testId="report-coverage"
              note={c.ceiling}
            />
          );
        })()}

      <div className="mt-5 space-y-5">
        {p.steps.map((s, i) => (
          <section key={s.key} aria-labelledby={`review-${s.key}`}>
            <div className="flex items-baseline justify-between border-b border-line pb-1">
              <h3 id={`review-${s.key}`} className="font-sans text-sm font-semibold">
                {s.title}
              </h3>
              <button type="button" className="text-sm text-bronze-ink underline" onClick={() => p.goTo(i)}>
                Edit<span className="sr-only"> {s.title}</span>
              </button>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {s.fields.filter((f) => isShown(f, p.intake)).map((f, idx) => (
                <div key={`${f.key}-${idx}`} className="flex justify-between gap-3 py-0.5 sm:block">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="text-right break-words sm:text-left">
                    {p.intake[f.key] === undefined ? <span className="text-muted">Not given</span> : p.labelFor(f.key, p.intake[f.key])}
                  </dd>
                </div>
              ))}
              {s.documents && p.uploads && (
                <div className="flex justify-between gap-3 py-0.5 sm:col-span-2 sm:block">
                  <dt className="text-muted">Documents</dt>
                  <dd>
                    {p.uploads.items.filter((x) => x.status === "done").length === 0
                      ? <span className="text-muted">None uploaded</span>
                      : p.uploads.items
                          .filter((x) => x.status === "done")
                          .map((x) => x.name)
                          .join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        ))}
      </div>

      {p.notAsked.length > 0 && (
        <div className="mt-5 rounded-lg bg-sand p-4 text-sm text-ink-2">
          <p className="font-medium">Not asked, on purpose</p>
          <ul className="mt-1 list-disc pl-5">
            {p.notAsked.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-1">The report lists them as next steps for a fuller study.</p>
        </div>
      )}

      {p.runError && (
        <p role="alert" className="mt-5 rounded-lg bg-bad-soft px-4 py-2 text-sm text-bad">
          {p.runError}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {busy && (
          <p role="status" className="text-sm text-muted" data-testid="waiting-uploads">
            Waiting for uploads to finish…
          </p>
        )}
        <Button size="lg" onClick={p.onGenerate} disabled={p.issues.length > 0 || p.generating || busy}>
          {p.generating ? "Starting…" : "Generate report"}
        </Button>
      </div>
    </div>
  );
}

function CoverageList({ title, rows, note, testId }: { title: string; rows: { label: string; coverage: Coverage }[]; note: string | null; testId: string }) {
  return (
    <div className="mt-5 rounded-lg border border-line p-4" data-testid={testId}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-2 divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 py-1">
            <span>{r.label}</span>
            <Badge tone={COVERAGE_TONE[r.coverage]}>{COVERAGE_TEXT[r.coverage]}</Badge>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-xs text-ink-2">{note}</p>}
    </div>
  );
}
