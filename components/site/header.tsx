import Link from "next/link";
import { nav } from "@/content/site";
import { Logo } from "./logo";
import { AuthCta } from "./auth-cta";
import { MobileMenu } from "./mobile-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-bronze bg-navy text-white">
      <div className="container-page flex h-16 items-center gap-6">
        <Logo priority />
        <nav aria-label="Main" className="hidden flex-1 items-center gap-6 md:flex">
          {nav.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-mist no-underline hover:text-gold">
              {l.label}
            </Link>
          ))}
        </nav>
        <AuthCta className="ml-auto hidden md:flex" />
        <div className="ml-auto md:hidden">
          <MobileMenu links={nav} />
        </div>
      </div>
    </header>
  );
}
