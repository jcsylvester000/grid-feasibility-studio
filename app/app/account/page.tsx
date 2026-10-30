import type { Metadata } from "next";
import { CopyButton } from "@/components/auth/copy-button";
import { ChangePasswordForm, DeleteAccountForm, NewRecoveryKeyForm } from "@/components/app/account-forms";
import { requireUser } from "@/lib/auth/session";
import { TopUpButton } from "@/components/tokens/top-up-button";
import { getBalance, listLedger } from "@/lib/db/repos/tokens";
import { demoEnabled } from "@/lib/demo/seed";
import { formatDate, formatDateTime } from "@/lib/format";
import { productInfo } from "@/lib/options/products";
import { DEMO_TOP_UP, MAX_BALANCE, tokenCosts, tokensEnabled, tokenWord } from "@/lib/tokens/config";
import type { Product } from "@/lib/db/schema";
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
  const wallet = tokensEnabled() ? { balance: await getBalance(user.id), ledger: await listLedger(user.id, 25) } : null;
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

      {wallet && <TokenWallet balance={wallet.balance} ledger={wallet.ledger} />}

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

type LedgerRow = Awaited<ReturnType<typeof listLedger>>[number];

const ENTRY_TEXT: Record<string, string> = {
  opening: "Opening balance",
  charge: "Report generated",
  refund: "Returned: report not generated",
  top_up: "Demo tokens added",
};

/** GRID Token wallet (prototype). Shows tokens only; no cash value is displayed. */
function TokenWallet({ balance, ledger }: { balance: number; ledger: LedgerRow[] }) {
  const costs = Object.entries(tokenCosts()).filter(([, c]) => c && c > 0) as [Product, number][];
  return (
    <Section id="tokens" title="GRID Token wallet" lead="Reports use GRID Tokens. You are asked before any tokens are used.">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Balance</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums" data-testid="wallet-balance">
            {balance} <span className="text-base font-normal text-muted">{tokenWord(balance)}</span>
          </p>
        </div>
        {demoEnabled() && <TopUpButton amount={DEMO_TOP_UP} disabled={balance >= MAX_BALANCE} />}
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {costs.map(([p, c]) => (
          <li key={p}>
            Each {productInfo(p).name} uses <strong>{c} {tokenWord(c)}</strong>.
          </li>
        ))}
        <li className="text-muted">{costs.length < 3 ? "Reports not listed do not use tokens yet. " : ""}If a report cannot be generated, its tokens are returned.</li>
      </ul>
      <h3 className="mt-6 text-base font-semibold">Activity</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm" data-testid="wallet-activity">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Date</th>
              <th scope="col" className="py-2 pr-3 font-medium">Description</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Change</th>
              <th scope="col" className="py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDateTime(e.at)}</td>
                <td className="py-2 pr-3">
                  {ENTRY_TEXT[e.kind] ?? e.kind}
                  {e.reportTitle && (
                    <>
                      {": "}
                      {e.reportId ? <a href={`/app/reports/${e.reportId}`}>{e.reportTitle}</a> : e.reportTitle}
                    </>
                  )}
                </td>
                <td className={`py-2 pr-3 text-right tabular-nums ${e.delta < 0 ? "text-bad" : "text-ok"}`}>
                  {e.delta > 0 ? "+" : e.delta < 0 ? "−" : ""}
                  {Math.abs(e.delta)}
                </td>
                <td className="py-2 text-right tabular-nums">{e.balanceAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">Prototype wallet for demonstrations. GRID Tokens shown here are not purchased and have no cash value in this app.</p>
    </Section>
  );
}
