"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, type FormState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { FormError } from "./auth-card";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit-button";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  const [username, setUsername] = useState(state.values?.username ?? "");
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="space-y-5">
      <FormError message={state.formError} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="username" label="Username">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <Field id="password" label="Password">
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/reset">Forgot password?</Link>
        <Link href="/register">Create an account</Link>
      </div>
    </form>
  );
}
