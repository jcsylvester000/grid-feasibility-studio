import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · GRID" }, robots: { index: false, follow: false } };

/** Admin area (AD-01 to AD-05). Non-admins get 404. Everyone is shown by User ID only (PV-02). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-dvh bg-cream">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b-[3px] border-bronze bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-gold" title="Your User ID">
              {user.publicId}
            </span>
            <form method="post" action="/api/auth/logout">
              <button type="submit" className="rounded-lg px-2 py-1 text-sm text-mist hover:text-gold">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <AdminNav />
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
