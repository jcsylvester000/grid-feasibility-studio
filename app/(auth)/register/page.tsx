import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { redirectIfSignedIn } from "@/lib/auth/redirect-signed-in";

export const metadata: Metadata = { title: "Create account", alternates: { canonical: "/register" } };

export default async function RegisterPage() {
  await redirectIfSignedIn();
  return (
    <AuthCard title="Create your account" lead="Username and password only. No email needed.">
      <RegisterForm />
    </AuthCard>
  );
}
