"use client";
/** Viewer header actions (S-05): Print and Run again. Print records report.printed (BRD 11.1). */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTokenConfirm, type TokenInfo } from "@/components/tokens/token-confirm";

export function PrintButton({ reportId }: { reportId: string }) {
  return (
    <Button
      type="button"
      onClick={() => {
        void fetch(`/api/reports/${reportId}/events`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: "printed" }),
          keepalive: true,
        }).catch(() => {});
        window.print();
      }}
    >
      Print or save as PDF
    </Button>
  );
}

export function RunAgainButton({ reportId, tokens = null }: { reportId: string; tokens?: TokenInfo | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useTokenConfirm(tokens, "Run again");
  const short = !!tokens && tokens.balance < tokens.cost;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {confirm.dialog}
      <Button
        type="button"
        variant="outline"
        disabled={busy || short}
        title={short ? `Not enough GRID Tokens: this report uses ${tokens!.cost}, your wallet has ${tokens!.balance}.` : undefined}
        data-testid="run-again"
        onClick={async () => {
          if (!(await confirm.ask())) return;
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/reports/${reportId}/runs`, { method: "POST" });
          if (res.status === 202) return router.replace(`/app/reports/${reportId}/run`);
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message ?? "The report could not be started.");
          setBusy(false);
        }}
      >
        {busy ? "Starting…" : "Run again"}
      </Button>
      <span role="status" className="min-h-4 text-xs text-bad">
        {error ?? (short ? `Not enough GRID Tokens (uses ${tokens!.cost}, you have ${tokens!.balance}).` : null)}
      </span>
    </span>
  );
}
