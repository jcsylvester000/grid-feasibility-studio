"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  deleteAccountAction,
  newRecoveryKeyAction,
  type AccountState,
} from "@/app/app/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const HINT = "At least 15 characters. A phrase of a few words is fine.";

function Status({ state }: { state: AccountState }) {
  if (state.ok) return <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{state.ok}</p>;
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>;
  return null;
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<AccountState, FormData>(changePasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" key={state.ok ? "done" : "form"}>
      <Status state={state} />
      <Field id="current" label="Current password" error={fe.current}>
        <PasswordInput id="current" name="current" autoComplete="current-password" required {...describedBy("current", fe.current)} />
      </Field>
      <Field id="new-password" label="New password" hint={HINT} error={fe.password}>
        <PasswordInput id="new-password" name="password" autoComplete="new-password" required {...describedBy("new-password", fe.password, HINT)} />
      </Field>
      <Field id="confirm-password" label="Confirm new password" error={fe.confirmPassword}>
        <PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" required {...describedBy("confirm-password", fe.confirmPassword)} />
      </Field>
      <div className="max-w-xs"><SubmitButton pendingLabel="Saving…">Change password</SubmitButton></div>
    </form>
  );
}

export function NewRecoveryKeyForm() {
  const [state, action] = useActionState<AccountState, FormData>(newRecoveryKeyAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      <Field id="key-password" label="Your password" error={fe.password}>
        <PasswordInput id="key-password" name="password" autoComplete="current-password" required {...describedBy("key-password", fe.password)} />
      </Field>
      <div className="max-w-xs"><SubmitButton pendingLabel="Creating…">Create a new recovery key</SubmitButton></div>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action] = useActionState<AccountState, FormData>(deleteAccountAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      <Field id="confirmUsername" label={`Type your username (${username}) to confirm`} error={fe.confirmUsername}>
        <Input id="confirmUsername" name="confirmUsername" autoComplete="off" autoCapitalize="none" required {...describedBy("confirmUsername", fe.confirmUsername)} />
      </Field>
      <button type="submit" className="rounded-lg bg-bad px-4 py-2.5 text-sm font-medium text-white hover:bg-[#8f2e2e]">
        Delete my account
      </button>
    </form>
  );
}
