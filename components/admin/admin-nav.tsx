"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/runs", label: "Runs" },
  { href: "/admin/pipelines", label: "Pipelines" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="border-b border-line bg-white">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
        {items.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("inline-block border-b-2 px-3 py-3 text-sm font-medium no-underline", active ? "border-bronze text-navy" : "border-transparent text-ink-2 hover:text-navy")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
