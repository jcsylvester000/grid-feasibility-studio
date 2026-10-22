"use client";

/**
 * Step form for a report (BRD S-03). Steps on the left (top on phones), the current step in the centre,
 * a summary of answers on the right on desktop; last step Review with Edit links and Generate.
 * Every change autosaves after 800 ms (PATCH /api/reports/{id}); an offline banner shows when the
 * browser is offline and changes save on reconnect.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FieldEntry, LocationTree } from "@/lib/options";
import { validateQuickReport } from "@/lib/forms/quick-report";
import { isShown, type FormStep, type Intake, type Issue } from "@/lib/forms/types";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

type Props = {
  reportId: string;
  productName: string;
  steps: FormStep[];
  fields: FieldEntry[];
  locations: LocationTree;
  initialIntake: Intake;
  notAsked: string[];
  titleFor: { prefix: string; fallback: string };
};

const selectCls =
  "h-11 w-full rounded-lg border border-line-2 bg-white px-3 text-[15px] text-ink disabled:bg-sand disabled:text-muted aria-[invalid=true]:border-bad";

export function ReportForm(props: Props) {
  const { reportId, steps, fields, locations } = props;
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
  const ctx = useMemo(() => ({ fields, locations }), [fields, locations]);
  const validation = useMemo(() => validateQuickReport(intake, ctx), [intake, ctx]);
  const issuesByKey = useMemo(() => Object.fromEntries(validation.issues.map((i) => [i.key, i])), [validation]);

  const title = useMemo(() => {
    const city = intake["property.city"];
    const province = intake["property.province"];
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

  function setValue(key: string, value: string) {
    dirty.current = true;
    setSave("idle");
    setTouched((t) => ({ ...t, [key]: true }));
    setIntake((prev) => {
      const next: Intake = { ...prev };
      const field = fields.find((f) => f.key === key);
      const opt = field?.options?.find((o) => String(o.value) === value);
      if (value === "") delete next[key];
      else next[key] = opt ? opt.value : value;
      // Cascading location: changing a level clears the levels below it.
      if (key === "property.region") {
        delete next["property.province"];
        delete next["property.city"];
      }
      if (key === "property.province") delete next["property.city"];
      return next;
    });
  }

  function optionsFor(step: FormStep, key: string, kind?: string): { value: string; label: string }[] {
    void step;
    if (kind === "location.region") return Object.keys(locations).map((r) => ({ value: r, label: r }));
    if (kind === "location.province")
      return Object.keys(locations[String(intake["property.region"])] ?? {}).map((p) => ({ value: p, label: p }));
    if (kind === "location.city")
      return (locations[String(intake["property.region"])]?.[String(intake["property.province"])] ?? []).map((c) => ({ value: c, label: c }));
    return (fields.find((f) => f.key === key)?.options ?? []).map((o) => ({ value: String(o.value), label: o.label }));
  }

  const labelFor = (key: string, value: unknown) => {
    const opt = fields.find((f) => f.key === key)?.options?.find((o) => String(o.value) === String(value));
    return opt?.label ?? String(value);
  };

  const stepIssues = (s: FormStep) => validation.issues.filter((i) => i.step === s.key);
  const stepComplete = (s: FormStep) => stepIssues(s).length === 0;

  async function generate() {
    setRunError(null);
    setGenerating(true);
    try {
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
    <div className="space-y-4" data-testid="report-form-client">
      {!online && (
        <p role="status" className="rounded-lg bg-warn-soft px-4 py-2 text-sm text-warn">
          You are offline. Changes will save when you reconnect.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_260px] [&>*]:min-w-0">
        {/* Steps */}
        <nav aria-label="Form steps">
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {[...steps, { key: "review", title: "Review" } as FormStep].map((s, i) => {
              const done = i < reviewIndex ? stepComplete(s) : false;
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
                        "flex size-5 items-center justify-center rounded-full text-[11px]",
                        done ? "bg-ok text-white" : i === stepIndex ? "bg-gold text-navy" : "bg-sand text-muted",
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {s.title}
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
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {current.fields.filter((f) => isShown(f, intake)).map((f) => {
                  const opts = optionsFor(current, f.key, f.kind);
                  const issue = touched[f.key] ? issuesByKey[f.key] : undefined;
                  const disabled = f.kind === "location.province" ? !intake["property.region"] : f.kind === "location.city" ? !intake["property.province"] : false;
                  const id = `f-${f.key.replace(/\W/g, "-")}`;
                  return (
                    <div key={f.key} className="space-y-1.5">
                      <label htmlFor={id} className="block text-sm font-medium">
                        {f.label}
                        {f.required && <span className="text-bad" aria-hidden> *</span>}
                        {f.required && <span className="sr-only"> (required)</span>}
                      </label>
                      <select
                        id={id}
                        name={f.key}
                        className={selectCls}
                        value={intake[f.key] === undefined ? "" : String(intake[f.key])}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        disabled={disabled}
                        aria-invalid={issue ? true : undefined}
                        aria-describedby={issue ? `${id}-error` : undefined}
                      >
                        <option value="">{disabled ? "Choose the level above first" : "Select…"}</option>
                        {opts.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {issue && (
                        <p id={`${id}-error`} role="alert" className="text-sm text-bad">
                          {issue.message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
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
              steps={steps}
              intake={intake}
              issues={validation.issues}
              labelFor={labelFor}
              goTo={goTo}
              notAsked={props.notAsked}
              onGenerate={generate}
              generating={generating}
              runError={runError}
            />
          )}
        </section>

        {/* Summary */}
        <aside aria-label="Your answers" className="hidden lg:block">
          <div className="sticky top-24 rounded-[var(--radius-card)] border border-line bg-white p-4">
            <p className="eyebrow">{props.productName}</p>
            <p className="mt-2 text-sm font-medium">{title}</p>
            <dl className="mt-3 space-y-2 text-sm">
              {steps.flatMap((s) => s.fields.filter((f) => isShown(f, intake) && intake[f.key] !== undefined)).map((f) => (
                <div key={f.key}>
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd>{labelFor(f.key, intake[f.key])}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">
              {validation.ok ? "Everything required is in." : `Still needed: ${validation.issues.length}`}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Review(p: {
  steps: FormStep[];
  intake: Intake;
  issues: Issue[];
  labelFor: (k: string, v: unknown) => string;
  goTo: (i: number) => void;
  notAsked: string[];
  onGenerate: () => void;
  generating: boolean;
  runError: string | null;
}) {
  return (
    <div>
      <h2 id="step-heading" tabIndex={-1} className="mt-2 text-2xl outline-none">
        Review
      </h2>
      <p className="mt-1 text-sm text-muted">Check your answers, then generate. The result is an indicative screen, not a feasibility verdict.</p>

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
              {s.fields.filter((f) => isShown(f, p.intake)).map((f) => (
                <div key={f.key} className="flex justify-between gap-3 py-0.5 sm:block">
                  <dt className="text-muted">{f.label}</dt>
                  <dd>{p.intake[f.key] === undefined ? <span className="text-muted">Not given</span> : p.labelFor(f.key, p.intake[f.key])}</dd>
                </div>
              ))}
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
      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={p.onGenerate} disabled={p.issues.length > 0 || p.generating}>
          {p.generating ? "Starting…" : "Generate report"}
        </Button>
      </div>
    </div>
  );
}
