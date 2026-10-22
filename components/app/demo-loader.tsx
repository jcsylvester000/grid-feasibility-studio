"use client";
/** Loads the 20 demo scenarios into this account (demo mode only). */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DemoLoader({ loaded }: { loaded: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section aria-labelledby="demo-h" className="rounded-[var(--radius-card)] border border-dashed border-bronze/60 bg-bronze-soft/50 p-5" data-testid="demo-loader">
      <h2 id="demo-h" className="text-xl">Demo scenarios</h2>
      <p className="mt-1 text-sm text-ink-2">
        {loaded > 0
          ? `${loaded} of 20 demo scenarios are in this account (titles start with "Demo").`
          : "Load 20 ready-made reports (8 Quick Reports, 6 Executive Summaries, 6 Feasibility Reports) to demo the Studio. Every property, company and figure is invented."}
      </p>
      {loaded < 20 && (
        <Button
          className="mt-3"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch("/api/demo/seed", { method: "POST" });
            const body = await res.json().catch(() => ({}));
            setMsg(res.ok ? `${body.created} demo reports added.` : (body?.error?.message ?? "The demo scenarios could not be loaded."));
            setBusy(false);
            router.refresh();
          }}
        >
          {busy ? "Loading…" : "Load the 20 demo scenarios"}
        </Button>
      )}
      <p role="status" className="mt-2 min-h-5 text-sm text-muted">{msg}</p>
    </section>
  );
}
