import type { Metadata } from "next";
import { CopyButton } from "@/components/auth/copy-button";
import { ChangePasswordForm, DeleteAccountForm, NewRecoveryKeyForm } from "@/components/app/account-forms";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { logoutAllAction } from "../actions";

export const metadata: Metadata = { title: "Account" };

function Section({ id, title, lead, children, danger = false }: { id: string; title: string; lead?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section aria-labelledby={id} className={`rounded-[var(--radius-card)] border bg-white p-5 sm:p-6 ${danger ? "border-bad/30" : "border-line"}`}>
      <h2 id={id} className="text-2xl">{title}</h2>
      {lead && <p className="mt-1 text-sm text-muted">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AccountPage() {
  const { user } = await requireUser("/app/account");
  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Your account</h1>
      </header>

      <Section id="identity" title="Your details">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">User ID</dt>
            <dd className="mt-1 flex items-center gap-3">
              <span className="font-mono text-lg" data-testid="account-public-id">{user.publicId}</span>
              <CopyButton text={user.publicId} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Username</dt>
            <dd className="mt-1 text-lg">{user.displayUsername}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          GRID support asks for your User ID, never your password. Member since {formatDate(user.createdAt)}.
        </p>
      </Section>

      <Section id="password" title="Change password" lead="Other devices are signed out when you change it.">
        <ChangePasswordForm />
      </Section>

      <Section id="recovery" title="New recovery key" lead="Your old key stops working. The new one is shown once.">
        <NewRecoveryKeyForm />
      </Section>

      <Section id="sessions" title="Log out of all devices" lead="Ends every session, including this one.">
        <form action={logoutAllAction}>
          <button type="submit" className="rounded-lg border border-line-2 px-4 py-2.5 text-sm font-medium hover:border-bronze">
            Log out of all devices
          </button>
        </form>
      </Section>

      <Section id="delete" title="Delete account" danger lead="Removes your account, reports, results and files immediately. This cannot be undone.">
        <DeleteAccountForm username={user.displayUsername} />
      </Section>
    </div>
  );
}
