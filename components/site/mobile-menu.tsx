"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AuthCta } from "./auth-cta";

/** Phone navigation (the only client script on public pages besides AuthCta, BRD P-01). */
export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-lg text-white hover:bg-white/10"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      <div
        id={id}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b-[3px] border-bronze bg-navy px-4 pb-5 pt-2 shadow-lg"
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              onClick={() => setOpen(false)}
              className="border-b border-white/10 py-3 text-white no-underline hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div onClick={() => setOpen(false)}>
          <AuthCta stacked className="mt-4" />
        </div>
      </div>
    </div>
  );
}
