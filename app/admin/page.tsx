import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// B2 placeholder: the usage overview (AD-01) arrives in batch B8.
export default async function AdminHome() {
  const { user } = await requireAdmin();
  return (
    <main className="container-page max-w-2xl py-16">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-4xl">Usage overview</h1>
      <p className="mt-3 text-muted">
        Signed in as admin <span className="font-mono text-ink">{user.publicId}</span>. Usage monitoring arrives in batch B8.
      </p>
      <form method="post" action="/api/auth/logout" className="mt-8">
        <button type="submit" className="rounded-lg bg-navy px-4 py-2 text-white">
          Log out
        </button>
      </form>
    </main>
  );
}
