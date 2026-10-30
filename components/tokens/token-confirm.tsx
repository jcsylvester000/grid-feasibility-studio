"use client";
/**
 * Asks before a report uses GRID Tokens (native <dialog>: focus is kept inside and Escape cancels).
 * Usage: const confirm = useTokenConfirm(); … if (await confirm.ask()) start();  and render {confirm.dialog}.
 */
import { Coins } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type TokenInfo = { cost: number; balance: number; productName: string };

const word = (n: number) => (n === 1 ? "GRID Token" : "GRID Tokens");

export function useTokenConfirm(tokens: TokenInfo | null | undefined, action = "Generate") {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);

  const ask = useCallback(() => {
    if (!tokens || tokens.cost <= 0) return Promise.resolve(true);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [tokens]);

  const close = useCallback((ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const dialog =
    tokens && tokens.cost > 0 ? (
      <dialog
        ref={ref}
        aria-labelledby="token-confirm-title"
        aria-describedby="token-confirm-body"
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        className="m-auto w-[min(92vw,28rem)] rounded-[var(--radius-card)] border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-navy/50"
        data-testid="token-confirm"
      >
        <div className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-bronze-soft text-bronze-ink">
              <Coins aria-hidden className="size-5" />
            </span>
            <h2 id="token-confirm-title" className="text-xl">
              Use {tokens.cost} {word(tokens.cost)}?
            </h2>
          </div>
          <div id="token-confirm-body" className="mt-4 space-y-3 text-sm">
            <p>
              This {tokens.productName} uses <strong>{tokens.cost} {word(tokens.cost)}</strong>.
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-lg bg-sand px-4 py-3 tabular-nums">
              <dt className="text-muted">Balance now</dt>
              <dd className="text-right">{tokens.balance}</dd>
              <dt className="text-muted">This report</dt>
              <dd className="text-right">−{tokens.cost}</dd>
              <dt className="font-medium">Balance after</dt>
              <dd className="text-right font-semibold" data-testid="token-balance-after">{tokens.balance - tokens.cost}</dd>
            </dl>
            <p className="text-xs text-muted">If the report cannot be generated, the tokens are returned to your wallet automatically.</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => close(true)} autoFocus data-testid="token-confirm-ok">
              Use {tokens.cost} {word(tokens.cost)} and {action.toLowerCase()}
            </Button>
          </div>
        </div>
      </dialog>
    ) : null;

  return { ask, dialog };
}

/** Shown instead of an action when the balance is too low. */
export function NotEnoughTokens({ tokens, className }: { tokens: TokenInfo; className?: string }) {
  return (
    <p role="note" className={className ?? "rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-ink"} data-testid="not-enough-tokens">
      <strong className="font-semibold text-bad">Not enough GRID Tokens.</strong> This {tokens.productName} uses {tokens.cost} {word(tokens.cost)}; your wallet
      has {tokens.balance}. <a href="/app/account#tokens">See your wallet</a>.
    </p>
  );
}
