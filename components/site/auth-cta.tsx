"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Header actions. Signed-in visitors see "Go to dashboard" instead of Create account. The page stays
 * static: we read the non-secret `grid_signed_in` cookie on the client (the session cookie itself is
 * HttpOnly). Set and cleared together with the session from batch B2.
 */
const subscribe = () => () => {};
const isSignedIn = () => /(?:^|;\s*)grid_signed_in=1(?:;|$)/.test(document.cookie);

export function AuthCta({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  const signedIn = useSyncExternalStore(subscribe, isSignedIn, () => false);
  if (signedIn) {
    return (
      <div className={cn("flex gap-2", stacked && "flex-col", className)}>
        <Link href="/app" className={buttonVariants({ variant: "primary", size: "sm" })}>
          Go to dashboard
        </Link>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2", stacked && "flex-col items-stretch", className)}>
      <Link href="/login" className={buttonVariants({ variant: "ghost-light", size: "sm" })}>
        Log in
      </Link>
      <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
        Create account
      </Link>
    </div>
  );
}
