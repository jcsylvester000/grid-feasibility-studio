import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Reset password", alternates: { canonical: "/reset" } };

export default function ResetPage() {
  return (
    <AuthCard
      title="Reset your password"
      lead="Use the recovery key you saved when you created your account, or a reset code from GRID support."
    >
      <ResetForm />
    </AuthCard>
  );
}
