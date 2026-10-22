"use server";

import { redirect } from "next/navigation";
import { authenticate, registerAccount, resetPassword, type FieldErrors } from "@/lib/auth/service";
import {
  clientAddress,
  isSameOrigin,
  setRecoveryKeyFlash,
  setSessionCookies,
} from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/redirects";

export type FormState = {
  fieldErrors?: FieldErrors;
  formError?: string;
  values?: { username?: string };
};

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

const lockMessage = (at?: Date) =>
  at
    ? `Too many attempts. Try again after ${new Intl.DateTimeFormat("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      }).format(at)}.`
    : "Too many attempts. Try again later.";

const ORIGIN_ERROR = "This request did not come from the GRID Feasibility Studio site. Reload the page and try again.";

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { username: str(fd, "username") };
  if (!(await isSameOrigin())) return { formError: ORIGIN_ERROR, values };
  const result = await registerAccount({
    username: values.username,
    password: str(fd, "password"),
    confirmPassword: str(fd, "confirmPassword"),
    acceptTerms: fd.get("acceptTerms") === "on",
    address: await clientAddress(),
  });
  if (!result.ok) {
    return {
      values,
      fieldErrors: result.fieldErrors,
      formError: result.formError === "RATE_LIMITED" ? "Too many sign-ups from this network. Try again in an hour." : undefined,
    };
  }
  await setSessionCookies(result.session);
  await setRecoveryKeyFlash(result.user.id, result.recoveryKey);
  redirect("/register/recovery-key");
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { username: str(fd, "username") };
  if (!(await isSameOrigin())) return { formError: ORIGIN_ERROR, values };
  const result = await authenticate({
    username: values.username,
    password: str(fd, "password"),
    address: await clientAddress(),
  });
  if (!result.ok) {
    const formError =
      result.code === "LOCKED"
        ? lockMessage(result.unlockAt)
        : result.code === "SUSPENDED"
          ? "This account is suspended. Contact GRID support."
          : "That username and password do not match.";
    return { values, formError };
  }
  await setSessionCookies(result.session);
  const home = result.user.role === "admin" ? "/admin" : "/app";
  const next = safeNext(str(fd, "next"), home);
  // Users never land in the admin area.
  redirect(result.user.role !== "admin" && next.startsWith("/admin") ? "/app" : next);
}

export async function resetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { username: str(fd, "username") };
  if (!(await isSameOrigin())) return { formError: ORIGIN_ERROR, values };
  const result = await resetPassword({
    username: values.username,
    secret: str(fd, "secret"),
    password: str(fd, "password"),
    confirmPassword: str(fd, "confirmPassword"),
    address: await clientAddress(),
  });
  if (!result.ok) {
    if (result.fieldErrors) return { values, fieldErrors: result.fieldErrors };
    const formError =
      result.code === "LOCKED"
        ? lockMessage(result.unlockAt)
        : result.code === "SUSPENDED"
          ? "This account is suspended. Contact GRID support."
          : "That username and key or code do not match.";
    return { values, formError };
  }
  await setSessionCookies(result.session);
  await setRecoveryKeyFlash(result.user.id, result.recoveryKey);
  redirect("/register/recovery-key?from=reset");
}
