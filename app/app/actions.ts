"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changePassword, deleteAccount, logoutEverywhere, regenerateRecoveryKey } from "@/lib/auth/account";
import { clearSessionCookies, isSameOrigin, requireUser, setRecoveryKeyFlash, setSessionCookies } from "@/lib/auth/session";
import { createReport, isEnabledProduct, removeReport } from "@/lib/reports/service";

const ORIGIN_ERROR = "This request did not come from the GRID Feasibility Studio site. Reload the page and try again.";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/** S-01 / S-02: choosing a product creates a draft and opens its form. */
export async function startReportAction(fd: FormData) {
  const { user } = await requireUser("/app/new");
  if (!(await isSameOrigin())) throw new Error(ORIGIN_ERROR);
  const product = str(fd, "product");
  if (!isEnabledProduct(product)) redirect("/app/new");
  const report = await createReport(user, product);
  redirect(`/app/new/${product}?id=${report.id}`);
}

/** S-06: delete after confirmation. */
export async function deleteReportAction(fd: FormData) {
  const { user } = await requireUser("/app/reports");
  if (!(await isSameOrigin())) throw new Error(ORIGIN_ERROR);
  await removeReport(user, str(fd, "id"));
  revalidatePath("/app");
  const back = str(fd, "back");
  redirect(back.startsWith("/app/reports?") ? `${back}&deleted=1` : "/app/reports?deleted=1");
}

export type AccountState = { ok?: string; error?: string; fieldErrors?: Record<string, string | undefined> };

export async function changePasswordAction(_p: AccountState, fd: FormData): Promise<AccountState> {
  const { user } = await requireUser("/app/account");
  if (!(await isSameOrigin())) return { error: ORIGIN_ERROR };
  const r = await changePassword(user, {
    current: str(fd, "current"),
    password: str(fd, "password"),
    confirmPassword: str(fd, "confirmPassword"),
  });
  if (!r.ok) return { fieldErrors: r.fieldErrors };
  await setSessionCookies(r.session);
  return { ok: "Password changed. Other devices were signed out." };
}

export async function newRecoveryKeyAction(_p: AccountState, fd: FormData): Promise<AccountState> {
  const { user } = await requireUser("/app/account");
  if (!(await isSameOrigin())) return { error: ORIGIN_ERROR };
  const r = await regenerateRecoveryKey(user, str(fd, "password"));
  if (!r.ok) return { fieldErrors: { password: r.error } };
  await setRecoveryKeyFlash(user.id, r.recoveryKey);
  redirect("/register/recovery-key?from=account");
}

export async function logoutAllAction() {
  const { user } = await requireUser("/app/account");
  if (!(await isSameOrigin())) throw new Error(ORIGIN_ERROR);
  await logoutEverywhere(user);
  await clearSessionCookies();
  redirect("/login");
}

export async function deleteAccountAction(_p: AccountState, fd: FormData): Promise<AccountState> {
  const { user } = await requireUser("/app/account");
  if (!(await isSameOrigin())) return { error: ORIGIN_ERROR };
  const r = await deleteAccount(user, str(fd, "confirmUsername"));
  if (!r.ok) return { fieldErrors: { confirmUsername: r.error } };
  await clearSessionCookies();
  redirect("/?account=deleted");
}
