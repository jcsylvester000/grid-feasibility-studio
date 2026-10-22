"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction, type FormState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Field, describedBy } from "@/components/ui/field";
import { FormError } from "./auth-card";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit-button";

const PASSWORD_HINT = "At least 15 characters. A phrase of a few words is fine.";
const USERNAME_HINT = "3 to 30 characters: letters, numbers, dots and underscores.";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});
  const [username, setUsername] = useState(state.values?.username ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [client, setClient] = useState<Partial<Record<"username" | "password" | "confirmPassword", string>>>({});

  const err = (k: "username" | "password" | "confirmPassword" | "acceptTerms") =>
    (k !== "acceptTerms" ? client[k] : undefined) ?? state.fieldErrors?.[k];

  async function checkUsername() {
    if (!username.trim()) return;
    try {
      const res = await fetch(`/api/auth/username-available?u=${encodeURIComponent(username.trim())}`);
      if (res.status === 429) return;
      const body = (await res.json()) as { available: boolean; reason?: string };
      setClient((c) => ({ ...c, username: body.available ? undefined : body.reason }));
    } catch {
      /* offline: the server checks again on submit */
    }
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.formError} />
      <Field id="username" label="Username" hint={USERNAME_HINT} error={err("username")}>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setClient((c) => ({ ...c, username: undefined }));
          }}
          onBlur={checkUsername}
          {...describedBy("username", err("username"), USERNAME_HINT)}
        />
      </Field>
      <Field id="password" label="Password" hint={PASSWORD_HINT} error={err("password")}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setClient((c) => ({ ...c, password: undefined }));
          }}
          onBlur={() =>
            setClient((c) => ({
              ...c,
              password: password && [...password].length < 15 ? "Use at least 15 characters. A phrase of a few words is fine." : undefined,
            }))
          }
          {...describedBy("password", err("password"), PASSWORD_HINT)}
        />
      </Field>
      <Field id="confirmPassword" label="Confirm password" error={err("confirmPassword")}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setClient((c) => ({ ...c, confirmPassword: undefined }));
          }}
          onBlur={() =>
            setClient((c) => ({ ...c, confirmPassword: confirm && confirm !== password ? "The passwords do not match." : undefined }))
          }
          {...describedBy("confirmPassword", err("confirmPassword"))}
        />
      </Field>
      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-0.5 size-4 accent-[var(--color-navy)]"
            aria-invalid={err("acceptTerms") ? true : undefined}
            aria-describedby={err("acceptTerms") ? "acceptTerms-error" : undefined}
          />
          <span>
            I accept the{" "}
            <Link href="/terms" target="_blank">
              Terms of Use
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" target="_blank">
              Privacy Notice
            </Link>
            .
          </span>
        </label>
        {err("acceptTerms") && (
          <p id="acceptTerms-error" role="alert" className="text-sm text-bad">
            {err("acceptTerms")}
          </p>
        )}
      </div>
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
