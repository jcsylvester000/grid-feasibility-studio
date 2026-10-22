"use client";

/**
 * Run status (BRD S-04). Polls GET /api/runs/{id} every 3 s, every 10 s after 5 minutes; pauses while
 * the tab is hidden and resumes on return. Opens the report when ready. Status changes are announced
 * to screen readers (live region).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDuration, formatElapsed } from "@/lib/duration";
import type { RunStatusView } from "@/lib/runs/service";
import { cn } from "@/lib/utils";

const STEPS = [
  { phase: "request_sent", label: "Request sent" },
  { phase: "files_attached", label: "Files attached" },
  { phase: "pipeline_working", label: "Pipeline working" },
  { phase: "checking", label: "Checking the result" },
  { phase: "done", label: "Report ready" },
];

export function RunStatus({ initial, formHref }: { initial: RunStatusView; formHref: string }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(initial.runId);

  const active = view.status === "queued" || view.status === "running";
  const retrying = !!view.nextRunId;

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as RunStatusView;
      if (next.nextRunId && next.status === "failed") {
        // An automatic retry was queued: follow it.
        runId.current = next.nextRunId;
        setView({ ...next, status: "queued", phase: "request_sent", message: null });
      } else setView(next);
      setFetchedAt(Date.now());
      if (next.status === "succeeded") router.replace(`/app/reports/${next.reportId}`);
    } catch {
      /* try again on the next tick */
    }
  }, [router]);

  // Polling loop.
  useEffect(() => {
    if (!(active || retrying)) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const interval = view.elapsedMs > 5 * 60_000 ? 10_000 : 3_000;
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") await poll();
        schedule();
      }, interval);
    };
    schedule();
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, retrying, poll, view.elapsedMs]);

  // Local clock for the elapsed timer between polls.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const elapsed = active ? view.elapsedMs + (now - fetchedAt) : view.elapsedMs;
  const pct = view.status === "succeeded" ? 100 : Math.min(95, Math.round((elapsed / Math.max(view.typicalMs, 1)) * 100));
  const phaseIndex = view.status === "succeeded" ? 4 : Math.max(0, STEPS.findIndex((s) => s.phase === view.phase));

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/runs/${runId.current}/cancel`, { method: "POST" });
    if (!res.ok) setError("The run had already finished.");
    await poll();
    setBusy(false);
  }

  async function retry() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${view.reportId}/runs`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.status === 202) {
      runId.current = body.runId;
      setView({ ...view, runId: body.runId, status: "queued", phase: "request_sent", elapsedMs: 0, errorCode: null, message: null, nextRunId: null });
      setFetchedAt(Date.now());
    } else setError(body?.error?.message ?? "The report could not be started.");
    setBusy(false);
  }

  const headline =
    view.status === "failed"
      ? "The report could not be generated"
      : view.status === "cancelled"
        ? "Cancelled"
        : view.status === "succeeded"
          ? "Your report is ready"
          : view.status === "queued"
            ? view.attempt > 1
              ? "Trying again…"
              : "Waiting for a free slot…"
            : "Your report is being prepared";

  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite" className="sr-only">
        {headline}
      </div>
      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
        <h2 className="text-2xl" data-testid="run-headline">
          {headline}
        </h2>
        {active && (
          <p className="mt-1 text-sm text-muted">
            Elapsed <span data-testid="run-elapsed">{formatElapsed(elapsed)}</span> · typical {formatDuration(view.typicalMs)}
          </p>
        )}

        {(active || view.status === "succeeded") && (
          <>
            <div
              className="mt-5 h-2.5 overflow-hidden rounded-full bg-sand"
              role="progressbar"
              aria-label="Progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div className="h-full rounded-full bg-bronze transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <ol className="mt-5 grid gap-2 sm:grid-cols-5">
              {STEPS.map((s, i) => (
                <li
                  key={s.phase}
                  aria-current={i === phaseIndex && active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex-col sm:items-start",
                    i < phaseIndex || view.status === "succeeded" ? "bg-ok-soft text-ok" : i === phaseIndex ? "bg-info-soft text-info" : "bg-sand text-muted",
                  )}
                >
                  <span aria-hidden>{i < phaseIndex || view.status === "succeeded" ? "✓" : i === phaseIndex ? "●" : "○"}</span>
                  {s.label}
                </li>
              ))}
            </ol>
          </>
        )}

        {(view.status === "failed" || view.status === "cancelled") && (
          <p className="mt-3 text-muted" data-testid="run-message">
            {view.message}
            {view.errorCode && view.errorCode !== "RUN_CANCELLED" && <span className="ml-2 font-mono text-xs">({view.errorCode})</span>}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {active && (
            <Button variant="outline" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          )}
          {view.status === "failed" && view.canRetry && !retrying && (
            <Button onClick={retry} disabled={busy}>
              Retry
            </Button>
          )}
          {(view.status === "failed" || view.status === "cancelled") && (
            <Link href={formHref} className={buttonVariants({ variant: view.status === "cancelled" ? "primary" : "outline" })}>
              {view.status === "cancelled" ? "Start again" : "Edit answers"}
            </Link>
          )}
          {view.status === "succeeded" && (
            <Link href={`/app/reports/${view.reportId}`} className={buttonVariants()}>
              View report
            </Link>
          )}
        </div>
        {active && <p className="mt-4 text-xs text-muted">You can leave this page. The report keeps running and appears in My reports.</p>}
      </section>
    </div>
  );
}
