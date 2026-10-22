import type { Metadata } from "next";
import Link from "next/link";
import { Empty, fmtAt, fmtBytes, fmtInt, fmtPct, Pager, PeriodPicker } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { periodFrom } from "@/lib/admin/service";
import { listUsers } from "@/lib/db/repos/admin";

export const metadata: Metadata = { title: "Users" };

type Search = Promise<Record<string, string | undefined>>;

/** AD-02 Users by User ID. Search matches User IDs only (AC-038); the CSV has no username column (AC-039). */
export default async function AdminUsers({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { key, period } = periodFrom(sp);
  const sort = sp.sort === "runs" || sp.sort === "storage" ? sp.sort : "last_active";
  const page = Number(sp.page) || 1;
  const list = await listUsers({ q: sp.q, status: sp.status, role: sp.role, sort, page, period });
  const keep = Object.fromEntries(Object.entries({ q: sp.q, status: sp.status, role: sp.role, sort, range: sp.range, from: sp.from, to: sp.to }).filter(([, v]) => v)) as Record<string, string>;
  const href = (o: Record<string, string>) => `/admin/users?${new URLSearchParams({ ...keep, ...o }).toString()}`;
  const exportHref = `/api/admin/export.csv?${new URLSearchParams({ view: "users", ...(sp.range ? { range: sp.range } : {}), ...(sp.from ? { from: sp.from, to: sp.to ?? "" } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Users</h1>
          <p className="mt-1 text-sm text-muted">By User ID only. Runs and success rate are for the selected period.</p>
        </div>
        <PeriodPicker current={key} period={period} base="/admin/users" extra={Object.fromEntries(Object.entries(keep).filter(([k]) => !["range", "from", "to"].includes(k)))} />
      </header>

      <form action="/admin/users" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4" role="search">
        <div className="space-y-1">
          <label htmlFor="q" className="block text-xs font-medium text-muted">User ID</label>
          <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="e.g. U-7K3" className="h-10 w-40 rounded-lg border border-line-2 px-3 font-mono text-sm uppercase" />
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className="block text-xs font-medium text-muted">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-lg border border-line-2 bg-white px-2 text-sm">
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="role" className="block text-xs font-medium text-muted">Role</label>
          <select id="role" name="role" defaultValue={sp.role ?? ""} className="h-10 rounded-lg border border-line-2 bg-white px-2 text-sm">
            <option value="">Any</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="sort" className="block text-xs font-medium text-muted">Sort by</label>
          <select id="sort" name="sort" defaultValue={sort} className="h-10 rounded-lg border border-line-2 bg-white px-2 text-sm">
            <option value="last_active">Last active</option>
            <option value="runs">Runs</option>
            <option value="storage">Storage</option>
          </select>
        </div>
        {sp.range && <input type="hidden" name="range" value={sp.range} />}
        <button type="submit" className="h-10 rounded-lg bg-navy px-4 text-sm font-medium text-white">Apply</button>
        <a href={exportHref} className="ml-auto h-10 rounded-lg border border-line-2 bg-white px-4 text-sm leading-10 no-underline hover:border-bronze" data-testid="export-users">
          Export CSV
        </a>
      </form>

      {list.items.length === 0 ? (
        <Empty>No users match.</Empty>
      ) : (
        <div tabIndex={0} className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[860px] text-left text-sm" data-testid="users-table">
            <thead className="bg-sand text-muted">
              <tr>
                {["User ID", "Role", "Status", "Registered", "Last active", "Runs", "Success rate", "Files", "Storage"].map((h, i) => (
                  <th key={h} scope="col" className={`px-3 py-2 font-medium ${i >= 5 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.items.map((u) => (
                <tr key={u.public_id} className="border-t border-line">
                  <td className="px-3 py-2 font-mono"><Link href={`/admin/users/${u.public_id}`}>{u.public_id}</Link></td>
                  <td className="px-3 py-2 capitalize">{u.role}</td>
                  <td className="px-3 py-2"><Badge tone={u.status === "active" ? "ok" : "bad"}>{u.status}</Badge></td>
                  <td className="px-3 py-2">{fmtAt(u.created_at)}</td>
                  <td className="px-3 py-2">{fmtAt(u.last_active_at)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(u.runs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(u.succeeded + u.failed ? u.succeeded / (u.succeeded + u.failed) : null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(u.files)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBytes(u.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} href={(p) => href({ page: String(p) })} />
    </div>
  );
}
