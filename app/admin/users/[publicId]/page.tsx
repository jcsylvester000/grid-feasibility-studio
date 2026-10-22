import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserActions } from "@/components/admin/user-actions";
import { fmtAt, fmtBytes, fmtInt, fmtMs } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/session";
import { userDetail } from "@/lib/db/repos/admin";

export const metadata: Metadata = { title: "User detail" };

/** AD-03 User detail: usage and support actions for one User ID. Events show type and time only. */
export default async function AdminUser({ params }: { params: Promise<{ publicId: string }> }) {
  const { user: admin } = await requireAdmin();
  const { publicId } = await params;
  const d = await userDetail(decodeURIComponent(publicId));
  if (!d) notFound();
  const products = [...new Set(d.runsByProduct.map((r) => r.product))];
  const statuses = ["succeeded", "failed", "cancelled", "queued", "running"];

  return (
    <div className="space-y-8">
      <Link href="/admin/users" className="text-sm">Back to users</Link>
      {d.user.status === "suspended" && (
        <p role="status" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad" data-testid="suspended-banner">
          This account is suspended. The user cannot sign in until it is reactivated.
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="font-mono text-3xl">{d.user.public_id}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={d.user.status === "active" ? "ok" : "bad"}>{d.user.status}</Badge>
            <span className="capitalize">{d.user.role}</span> · registered {fmtAt(d.user.created_at)} · last active {fmtAt(d.user.last_active_at)}
          </p>
        </div>
        <UserActions publicId={d.user.public_id} status={d.user.status} isSelf={d.user.public_id === admin.publicId} isAdmin={d.user.role === "admin"} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-white p-4 lg:col-span-2" aria-labelledby="runs-h">
          <h2 id="runs-h" className="mb-2 font-sans text-sm font-semibold">Runs by product and status</h2>
          {products.length === 0 ? (
            <p className="text-sm text-muted">No runs yet.</p>
          ) : (
            <table className="w-full text-left text-sm" data-testid="user-runs">
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-1.5 font-medium">Product</th>
                  {statuses.map((s) => <th key={s} scope="col" className="py-1.5 text-right font-medium capitalize">{s}</th>)}
                  <th scope="col" className="py-1.5 text-right font-medium">Median time</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p} className="border-t border-line">
                    <td className="py-1.5">{p.replace(/_/g, " ")}</td>
                    {statuses.map((s) => (
                      <td key={s} className="py-1.5 text-right tabular-nums">{fmtInt(d.runsByProduct.find((r) => r.product === p && r.status === s)?.n ?? 0)}</td>
                    ))}
                    <td className="py-1.5 text-right">{fmtMs(d.runTimes.find((t) => t.product === p)?.p50 ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="rounded-xl border border-line bg-white p-4" aria-labelledby="files-h">
          <h2 id="files-h" className="mb-2 font-sans text-sm font-semibold">Files</h2>
          <p className="font-display text-3xl">{fmtBytes(d.storage.bytes)}</p>
          <p className="text-sm text-muted">{fmtInt(d.storage.files)} files (counts only; names are visible to the owner only)</p>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white p-4" aria-labelledby="ev-h">
        <h2 id="ev-h" className="mb-2 font-sans text-sm font-semibold">Recent events</h2>
        <ul className="divide-y divide-line text-sm" data-testid="user-events">
          {d.events.map((e, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5">
              <span className="font-mono text-xs">{e.event}{e.product ? ` · ${e.product}` : ""}</span>
              <span className="text-muted">{fmtAt(e.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
