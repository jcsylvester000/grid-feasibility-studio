"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Dashboard", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/app/new", label: "New report", icon: "M12 5v14M5 12h14" },
  { href: "/app/reports", label: "My reports", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  { href: "/app/account", label: "Account", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

const isActive = (pathname: string, href: string) =>
  href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(href + "/");

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Sidebar on desktop; fixed bottom bar on phones (BRD S-01). */
export function AppNav() {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="App" className="hidden w-56 shrink-0 md:block">
        <ul className="sticky top-20 space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={isActive(pathname, i.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-2 no-underline hover:bg-sand",
                  isActive(pathname, i.href) && "bg-white text-navy shadow-[var(--shadow-card)] ring-1 ring-line",
                )}
              >
                <Icon d={i.icon} />
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav
        aria-label="App"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={isActive(pathname, i.href) ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted no-underline",
                  isActive(pathname, i.href) && "text-bronze-ink",
                )}
              >
                <Icon d={i.icon} />
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
