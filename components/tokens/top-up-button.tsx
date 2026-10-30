"use client";
/** Demo wallets only: adds GRID Tokens so a demo can keep going. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { announceTokens } from "@/components/tokens/token-chip";

export function TopUpButton({ amount, disabled = false }: { amount: number; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={busy || disabled}
        data-testid="token-top-up"
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/tokens/top-up", { method: "POST" });
          if (!res.ok) setError("The wallet could not be topped up. Try again.");
          router.refresh();
          announceTokens();
          setBusy(false);
        }}
      >
        {busy ? "Adding…" : `Add ${amount} demo tokens`}
      </Button>
      <span role="status" className="min-h-4 text-xs text-bad">{error}</span>
    </span>
  );
}
