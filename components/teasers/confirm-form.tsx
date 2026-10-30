"use client";
/**
 * Check and confirm (Teaser design S-18): three columns on desktop, stacked on phones. The pre-filled
 * Quick Report answers carry a "from teaser" chip with the quote; conflicts must be resolved and required
 * answers given before Confirm and run (TS-AC-02). Discard deletes the scan and its files.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Field } from "@/components/forms/report-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { quickReportForm, validateQuickReport } from "@/lib/forms/quick-report";
import { isRequired, isShown, type Intake } from "@/lib/forms/types";
import type { FieldEntry, LocationTree } from "@/lib/options";
import type { ConflictGroup, FactSource } from "@/lib/teasers/review";

type Props = {
  teaserId: string;
  fields: FieldEntry[];
  locations: LocationTree;
  prefill: Intake;
  sources: Record<string, FactSource>;
  conflicts: ConflictGroup[];
  files: string[];
  pastedText: string | null;
  aside: React.ReactNode;
};

export function ConfirmForm(p: Props) {
  const router = useRouter();
  const [intake, setIntake] = useState<Intake>(p.prefill);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"confirm" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctx = useMemo(() => ({ fields: p.fields, locations: p.locations }), [p.fields, p.locations]);
  const validation = useMemo(() => validateQuickReport(intake, ctx), [intake, ctx]);
  const issues = Object.fromEntries(validation.issues.map((i) => [i.key, i]));
  const open = p.conflicts.filter((g) => !resolutions[g.key]);
  const blocked = validation.issues.length > 0 || open.length > 0;

  function setValue(key: string, value: string) {
    setIntake((prev) => {
      const next: Intake = { ...prev };
      const opt = p.fields.find((f) => f.key === key)?.options?.find((o) => String(o.value) === value);
      if (value === "") delete next[key];
      else next[key] = opt ? opt.value : value;
      if (key === "property.region") {
        delete next["property.province"];
        delete next["property.city"];
      }
      if (key === "property.province") delete next["property.city"];
      return next;
    });
  }

  async function confirm() {
    setBusy("confirm");
    setError(null);
    const res = await fetch(`/api/teasers/${p.teaserId}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intake, resolutions }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 201 && body.reportId) {
      router.replace(body.runId ? `/app/reports/${body.reportId}/run` : `/app/new/quick_report?id=${body.reportId}`);
      return;
    }
    setError(body?.error?.message ?? "The scan could not be confirmed. Try again.");
    setBusy(null);
  }

  async function discard() {
    if (!window.confirm("Discard this scan and its files?")) return;
    setBusy("discard");
    const res = await fetch(`/api/reports/${p.teaserId}`, { method: "DELETE" });
    if (res.ok) router.push("/app/reports");
    else {
      setError("The scan could not be discarded.");
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_320px] [&>*]:min-w-0" data-testid="confirm-form">
      {/* The upload */}
      <aside aria-labelledby="upload-h" className="space-y-3">
        <h2 id="upload-h" className="font-sans text-sm font-semibold">Your upload</h2>
        <ul className="space-y-1 text-sm">
          {p.files.map((f, i) => (
            <li key={i} className="truncate rounded-lg border border-line bg-white px-3 py-2" title={f}>
              <span className="mr-1 font-mono text-xs text-muted">doc-{i + 1}</span>
              {f}
            </li>
          ))}
          {p.pastedText && (
            <li className="rounded-lg border border-line bg-white px-3 py-2">
              <span className="mr-1 font-mono text-xs text-muted">doc-{p.files.length + 1}</span>
              Pasted post text
              <span className="block text-xs text-muted">{p.pastedText.length} characters · not shown again, so contact details in it stay hidden</span>
            </li>
          )}
        </ul>
      </aside>

      {/* The pre-filled Quick Report */}
      <section aria-labelledby="prefill-h" className="space-y-5 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
        <div>
          <h2 id="prefill-h" className="text-2xl">Check the Quick Report answers</h2>
          <p className="mt-1 text-sm text-muted">
            Filled from the teaser. Each answer shows the words it came from. Change anything that is wrong; nothing is created until you confirm.
          </p>
        </div>

        {p.conflicts.length > 0 && (
          <div className="space-y-3" data-testid="conflicts">
            {p.conflicts.map((g) => (
              <fieldset key={g.key} className="rounded-lg border border-bad/40 bg-bad-soft/60 p-4">
                <legend className="px-1 text-sm font-semibold text-bad">Conflict: {g.label}</legend>
                <p className="text-sm text-ink-2">{g.message}</p>
                <div className="mt-2 space-y-1.5">
                  {g.options.map((o) => (
                    <label key={o.key} className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`conflict-${g.key}`}
                        value={o.key}
                        checked={resolutions[g.key] === o.key}
                        onChange={() => setResolutions((r) => ({ ...r, [g.key]: o.key }))}
                        className="mt-1 accent-[var(--color-navy)]"
                      />
                      <span>
                        {o.label}
                        {o.quote && o.quote !== o.label && <span className="block text-xs text-muted">&ldquo;{o.quote}&rdquo;</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {quickReportForm.steps.map((step) => (
          <div key={step.key} className="space-y-3">
            <h3 className="border-b border-line pb-1 font-sans text-sm font-semibold">{step.title}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              {step.fields.filter((f) => isShown(f, intake)).map((f) => {
                const src = p.sources[f.key];
                return (
                  <div key={f.key} className="space-y-1">
                    <Field f={f} intake={intake} ctx={ctx} issue={issues[f.key]} required={isRequired(f, intake)} onChange={(v) => setValue(f.key, String(v))} onBlur={() => {}} />
                    {src && (
                      <p className="text-xs text-ink-2" data-testid="from-teaser">
                        <Badge tone="brand" className="mr-1 text-[10px]">From teaser</Badge>
                        &ldquo;{src.quote}&rdquo;
                        {src.where && <span className="text-muted"> · {src.where}</span>}
                        {src.confidence && <span className="text-muted"> · {src.confidence} confidence</span>}
                        {src.note && <span className="block text-muted">{src.note}</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {error && (
          <p role="alert" className="rounded-lg bg-bad-soft px-4 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Button variant="outline" onClick={discard} disabled={busy !== null}>
            {busy === "discard" ? "Discarding…" : "Discard scan"}
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            {blocked && (
              <p className="text-sm text-muted" data-testid="confirm-blocked">
                {open.length > 0 ? `Resolve ${open.length} conflict${open.length > 1 ? "s" : ""}` : "Answer the required fields"} to continue.
              </p>
            )}
            <Button size="lg" onClick={confirm} disabled={blocked || busy !== null}>
              {busy === "confirm" ? "Starting…" : "Confirm and run Quick Report"}
            </Button>
          </div>
        </div>
      </section>

      {/* The teaser check */}
      <div>{p.aside}</div>
    </div>
  );
}
