import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/auth/redirect-signed-in";
import { safeNext } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Log in", alternates: { canonical: "/login" } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await redirectIfSignedIn();
  const { next } = await searchParams;
  const safe = safeNext(next, "");
  return (
    <AuthCard title="Log in" lead="Welcome back to GRID Feasibility Studio.">
      <LoginForm next={safe || undefined} />
    </AuthCard>
  );
}
