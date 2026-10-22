"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resetAction, type FormState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Field, describedBy } from "@/components/ui/field";
import { FormError } from "./auth-card";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit-button";

const PASSWORD_HINT = "At least 15 characters. A phrase of a few words is fine.";

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(resetAction, {});
  const [v, setV] = useState({ username: state.values?.username ?? "", secret: "", password: "", confirmPassword: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5">
      <FormError message={state.formError} />
      <Field id="username" label="Username">
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" required value={v.username} onChange={set("username")} />
      </Field>
      <Field id="secret" label="Recovery key or reset code" hint="For example ABCD-EFGH-JKMN-PQRS-TVWX" error={fe.secret}>
        <Input
          id="secret"
          name="secret"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono uppercase tracking-wider"
          required
          value={v.secret}
          onChange={set("secret")}
          {...describedBy("secret", fe.secret, "x")}
        />
      </Field>
      <Field id="password" label="New password" hint={PASSWORD_HINT} error={fe.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={v.password}
          onChange={set("password")}
          {...describedBy("password", fe.password, PASSWORD_HINT)}
        />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={fe.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={v.confirmPassword}
          onChange={set("confirmPassword")}
          {...describedBy("confirmPassword", fe.confirmPassword)}
        />
      </Field>
      <SubmitButton pendingLabel="Resetting…">Reset password</SubmitButton>
      <p className="text-sm text-muted">
        Lost your recovery key? Contact GRID support with your User ID. <Link href="/login">Back to log in</Link>
      </p>
    </form>
  );
}
