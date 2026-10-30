"use client";
/**
 * GRID Token balance in the app header. Links to the wallet on the Account page. The layout does not
 * re-render on client navigation, so the chip re-reads the balance on every page change and when a
 * "grid:tokens" event is sent (after a report starts or the wallet is topped up).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { LOW_BALANCE, tokenWord } from "@/lib/tokens/config";
import { cn } from "@/lib/utils";

export const announceTokens = () => window.dispatchEvent(new Event("grid:tokens"));

export function TokenChip({ balance: initial, minCost }: { balance: number; minCost: number }) {
  const pathname = usePathname();
  const [balance, setBalance] = useState(initial);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/tokens", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (live && b && typeof b.balance === "number") setBalance(b.balance);
        })
        .catch(() => {});
    void load();
    window.addEventListener("grid:tokens", load);
    return () => {
      live = false;
      window.removeEventListener("grid:tokens", load);
    };
  }, [pathname]);
  const empty = minCost > 0 && balance < minCost;
  const low = !empty && balance <= LOW_BALANCE;
  return (
    <Link
      href="/app/account#tokens"
      data-testid="token-chip"
      title={empty ? "Not enough GRID Tokens to run a report" : low ? "GRID Token balance is low" : "Your GRID Token balance"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium no-underline",
        empty ? "bg-bad-soft text-bad" : low ? "bg-warn-soft text-warn" : "bg-white/10 text-gold hover:bg-white/15",
      )}
    >
      <Coins aria-hidden className="size-3.5" />
      <span className="tabular-nums">{balance}</span>
      <span className="hidden sm:inline">{tokenWord(balance)}</span>
      <span className="sr-only sm:hidden">{tokenWord(balance)}</span>
    </Link>
  );
}
