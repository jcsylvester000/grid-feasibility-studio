import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/auth/redirect-signed-in";
import { safeNext } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Log in", alternates: { canonical: "/login" } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; ended?: string }> }) {
  await redirectIfSignedIn();
  const { next, ended } = await searchParams;
  const safe = safeNext(next, "");
  return (
    <AuthCard title="Log in" lead="Welcome back to GRID Feasibility Studio.">
      {ended && (
        <p role="status" className="mb-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-ink" data-testid="session-ended">
          You were signed out. If your account was suspended, contact GRID support with your User ID.
        </p>
      )}
      <LoginForm next={safe || undefined} />
    </AuthCard>
  );
}
