import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

// B2 placeholder: the full dashboard (S-01) and app shell arrive in batch B3.
export default async function AppHome() {
  const { user } = await requireUser("/app");
  return (
    <main className="container-page max-w-2xl py-16">
      <p className="eyebrow">Signed in</p>
      <h1 className="mt-3 text-4xl">Welcome, {user.displayUsername}</h1>
      <p className="mt-3 text-muted">
        Your User ID is <span className="font-mono text-ink">{user.publicId}</span>. The dashboard arrives in the next batch.
      </p>
      <form method="post" action="/api/auth/logout" className="mt-8">
        <button type="submit" className="rounded-lg bg-navy px-4 py-2 text-white">
          Log out
        </button>
      </form>
    </main>
  );
}
