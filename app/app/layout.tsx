import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { AppNav } from "@/components/app/app-nav";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("/app");
  return (
    <div className="min-h-dvh bg-cream">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b-[3px] border-bronze bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/app/account"
              className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-gold no-underline hover:bg-white/15"
              title="Your User ID"
            >
              {user.publicId}
            </Link>
            <form method="post" action="/api/auth/logout">
              <button type="submit" className="rounded-lg px-2 py-1 text-sm text-mist hover:text-gold">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 pb-24 pt-6 sm:px-6 md:pb-12 md:pt-8">
        <AppNav />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
