/**
 * Admin reads (BRD 11.2, AD-01 to AD-05). Every query reads the admin views or usage_daily only (PV-01),
 * through getAdminDb(). Days are Asia/Manila (UTC+8, no daylight saving). No query returns a username,
 * title, input, output or file name (PV-02).
 */
import { sql, type SQL } from "drizzle-orm";
import { getAdminDb } from "../admin-client";

export type Period = { from: string; to: string }; // inclusive Manila dates, YYYY-MM-DD

const MANILA = 8 * 3600_000;
/** Manila midnight of a date, as a UTC instant. */
export const startOf = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - MANILA);
export const endOf = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - MANILA + 86400_000);
export const manilaDate = (at: Date) => new Date(at.getTime() + MANILA).toISOString().slice(0, 10);
const day = (col: SQL) => sql`((${col} AT TIME ZONE 'UTC') + interval '8 hours')::date`;

async function rows<T>(q: SQL): Promise<T[]> {
  const db = await getAdminDb();
  const r = (await db.execute(q)) as unknown as { rows: T[] };
  return r.rows;
}
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// ------------------------------------------------------------------ AD-01

export async function usageSummary(p: Period) {
  const from = startOf(p.from);
  const to = endOf(p.to);
  const [s] = await rows<Record<string, unknown>>(sql`
    select
      (select count(*) from admin_users_v where status in ('active','suspended') and created_at < ${to}) as registered,
      (select count(distinct user_public_id) from admin_usage_v where at >= ${from} and at < ${to}) as active_users,
      (select count(*) from admin_usage_v where event = 'run.started' and at >= ${from} and at < ${to}) as runs,
      (select count(*) from admin_usage_v where event = 'run.succeeded' and at >= ${from} and at < ${to}) as succeeded,
      (select count(*) from admin_usage_v where event = 'run.failed' and at >= ${from} and at < ${to}) as failed,
      (select percentile_cont(0.5) within group (order by duration_ms) from admin_usage_v
         where event = 'run.succeeded' and duration_ms is not null and at >= ${from} and at < ${to}) as median_ms,
      (select coalesce(sum(bytes), 0) from admin_storage_v) as storage_bytes,
      (select coalesce(sum(files), 0) from admin_storage_v) as storage_files`);
  const succeeded = Number(s!.succeeded);
  const failed = Number(s!.failed);
  return {
    registered: Number(s!.registered),
    activeUsers: Number(s!.active_users),
    runs: Number(s!.runs),
    successRate: succeeded + failed ? succeeded / (succeeded + failed) : null,
    medianMs: num(s!.median_ms),
    storageBytes: Number(s!.storage_bytes),
    storageFiles: Number(s!.storage_files),
  };
}

/** Runs per day by product, active users per day, failures by code (AD-01 charts). */
export async function usageSeries(p: Period) {
  const from = startOf(p.from);
  const to = endOf(p.to);
  const [runs, active, failures] = await Promise.all([
    rows<{ d: string; product: string | null; n: number }>(sql`
      select ${day(sql`at`)}::text as d, product, count(*)::int as n from admin_usage_v
      where event = 'run.started' and at >= ${from} and at < ${to} group by 1, 2 order by 1`),
    rows<{ d: string; n: number }>(sql`
      select ${day(sql`at`)}::text as d, count(distinct user_public_id)::int as n from admin_usage_v
      where at >= ${from} and at < ${to} group by 1 order by 1`),
    rows<{ code: string | null; n: number }>(sql`
      select coalesce(error_code, 'UNKNOWN') as code, count(*)::int as n from admin_usage_v
      where event = 'run.failed' and at >= ${from} and at < ${to} group by 1 order by 2 desc limit 12`),
  ]);
  return { runs, active, failures };
}

export async function topUsers(p: Period, limit = 10) {
  return rows<{ user_public_id: string; runs: number; last_active: Date | null }>(sql`
    select user_public_id, count(*) filter (where event = 'run.started')::int as runs, max(at) as last_active
    from admin_usage_v where at >= ${startOf(p.from)} and at < ${endOf(p.to)}
    group by user_public_id order by runs desc, last_active desc limit ${limit}`);
}

// ------------------------------------------------------------------ AD-02

export type UserFilters = { q?: string; status?: string; role?: string; sort?: "last_active" | "runs" | "storage"; page?: number; pageSize?: number; period: Period };

export type AdminUserRow = {
  public_id: string;
  role: string;
  status: string;
  created_at: Date;
  last_active_at: Date | null;
  runs: number;
  succeeded: number;
  failed: number;
  files: number;
  bytes: number;
};

export async function listUsers(f: UserFilters) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 1), 1000);
  const page = Math.max(f.page ?? 1, 1);
  const where: SQL[] = [sql`true`];
  // AC-038: search matches User IDs only (never usernames, which the view does not contain).
  if (f.q) where.push(sql`u.public_id ilike ${`%${f.q.trim().toUpperCase().replace(/[%_\\]/g, "")}%`}`);
  if (f.status) where.push(sql`u.status = ${f.status}`);
  if (f.role) where.push(sql`u.role = ${f.role}`);
  const order =
    f.sort === "runs" ? sql`runs desc nulls last` : f.sort === "storage" ? sql`bytes desc nulls last` : sql`u.last_active_at desc nulls last`;
  const filter = sql.join(where, sql` and `);
  const from = startOf(f.period.from);
  const to = endOf(f.period.to);
  const items = await rows<AdminUserRow>(sql`
    select u.public_id, u.role, u.status, u.created_at, u.last_active_at,
      coalesce(e.runs, 0)::int as runs, coalesce(e.succeeded, 0)::int as succeeded, coalesce(e.failed, 0)::int as failed,
      coalesce(s.files, 0)::int as files, coalesce(s.bytes, 0)::bigint as bytes
    from admin_users_v u
    left join (
      select user_public_id,
        count(*) filter (where event = 'run.started') as runs,
        count(*) filter (where event = 'run.succeeded') as succeeded,
        count(*) filter (where event = 'run.failed') as failed
      from admin_usage_v where at >= ${from} and at < ${to} group by user_public_id
    ) e on e.user_public_id = u.public_id
    left join admin_storage_v s on s.user_public_id = u.public_id
    where ${filter}
    order by ${order}, u.public_id
    limit ${pageSize} offset ${(page - 1) * pageSize}`);
  const [c] = await rows<{ n: number }>(sql`select count(*)::int as n from admin_users_v u where ${filter}`);
  return { items: items.map((i) => ({ ...i, bytes: Number(i.bytes) })), total: Number(c?.n ?? 0), page, pageSize };
}

// ------------------------------------------------------------------ AD-03

export async function userDetail(publicId: string) {
  const [u] = await rows<{ public_id: string; role: string; status: string; created_at: Date; last_active_at: Date | null }>(
    sql`select public_id, role, status, created_at, last_active_at from admin_users_v where public_id = ${publicId}`,
  );
  if (!u) return null;
  const [byProduct, storage, events, times] = await Promise.all([
    rows<{ product: string; status: string; n: number }>(sql`
      select product, status, count(*)::int as n from admin_runs_v where user_public_id = ${publicId} group by 1, 2 order by 1, 2`),
    rows<{ files: number; bytes: number }>(sql`select files, bytes from admin_storage_v where user_public_id = ${publicId}`),
    rows<{ event: string; product: string | null; at: Date }>(sql`
      select event, product, at from admin_usage_v where user_public_id = ${publicId} order by at desc limit 50`),
    rows<{ product: string; p50: number | null; n: number }>(sql`
      select product, percentile_cont(0.5) within group (order by duration_ms) as p50, count(*)::int as n
      from admin_runs_v where user_public_id = ${publicId} and status = 'succeeded' and duration_ms is not null group by 1`),
  ]);
  return {
    user: u,
    runsByProduct: byProduct,
    storage: { files: Number(storage[0]?.files ?? 0), bytes: Number(storage[0]?.bytes ?? 0) },
    events,
    runTimes: times.map((t) => ({ ...t, p50: num(t.p50) })),
  };
}

// ------------------------------------------------------------------ AD-04

export type RunFilters = { product?: string; status?: string; code?: string; from?: string; to?: string; page?: number; pageSize?: number };

export type AdminRunRow = {
  id: string;
  user_public_id: string;
  product: string;
  pipeline_id: string | null;
  status: string;
  phase: string;
  attempt: number;
  error_code: string | null;
  http_status: number | null;
  vs_run_id: string | null;
  duration_ms: number | null;
  input_bytes: number | null;
  output_bytes: number | null;
  queued_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};

export async function listRuns(f: RunFilters) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 1), 1000);
  const page = Math.max(f.page ?? 1, 1);
  const where: SQL[] = [sql`true`];
  if (f.product) where.push(sql`product = ${f.product}`);
  if (f.status) where.push(sql`status = ${f.status}`);
  if (f.code) where.push(sql`error_code = ${f.code}`);
  if (f.from) where.push(sql`queued_at >= ${startOf(f.from)}`);
  if (f.to) where.push(sql`queued_at < ${endOf(f.to)}`);
  const filter = sql.join(where, sql` and `);
  const items = await rows<AdminRunRow>(sql`
    select * from admin_runs_v where ${filter} order by queued_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`);
  const [c] = await rows<{ n: number }>(sql`select count(*)::int as n from admin_runs_v where ${filter}`);
  const codes = await rows<{ code: string }>(sql`select distinct error_code as code from admin_runs_v where error_code is not null order by 1`);
  return { items, total: Number(c?.n ?? 0), page, pageSize, codes: codes.map((x) => x.code) };
}

export async function runDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await rows<AdminRunRow>(sql`select * from admin_runs_v where id = ${id}`);
  return r ?? null;
}

// ------------------------------------------------------------------ AD-05

export async function pipelineStats(product: string, now = new Date()) {
  const d7 = new Date(now.getTime() - 7 * 86400_000);
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const [s] = await rows<Record<string, unknown>>(sql`
    select
      count(*) filter (where queued_at >= ${d7}) as runs7,
      count(*) filter (where queued_at >= ${d7} and status = 'succeeded') as ok7,
      count(*) filter (where queued_at >= ${d7} and status = 'failed') as failed7,
      count(*) filter (where queued_at >= ${d30}) as runs30,
      count(*) filter (where queued_at >= ${d30} and status = 'succeeded') as ok30,
      count(*) filter (where queued_at >= ${d30} and status = 'failed') as failed30,
      count(*) filter (where status in ('queued','running')) as in_flight,
      max(finished_at) filter (where status = 'succeeded') as last_success,
      percentile_cont(0.5) within group (order by duration_ms) filter (where status = 'succeeded' and queued_at >= ${d30}) as p50,
      percentile_cont(0.95) within group (order by duration_ms) filter (where status = 'succeeded' and queued_at >= ${d30}) as p95
    from admin_runs_v where product = ${product}`);
  const codes = await rows<{ code: string; n: number }>(sql`
    select error_code as code, count(*)::int as n from admin_runs_v
    where product = ${product} and status = 'failed' and queued_at >= ${d30} and error_code is not null
    group by 1 order by 2 desc limit 5`);
  const rate = (ok: unknown, failed: unknown) => (Number(ok) + Number(failed) ? Number(ok) / (Number(ok) + Number(failed)) : null);
  return {
    runs7: Number(s!.runs7),
    runs30: Number(s!.runs30),
    successRate7: rate(s!.ok7, s!.failed7),
    successRate30: rate(s!.ok30, s!.failed30),
    inFlight: Number(s!.in_flight),
    lastSuccess: (s!.last_success as Date | null) ?? null,
    p50Ms: num(s!.p50),
    p95Ms: num(s!.p95),
    topCodes: codes,
  };
}

// ------------------------------------------------------------------ rollup (11.4)

/** Rebuilds usage_daily rows for one Manila date from usage events (idempotent). */
export async function rollupDay(date: string) {
  const db = await getAdminWriter();
  const from = startOf(date);
  const to = endOf(date);
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from usage_daily where date = ${date}`);
    await tx.execute(sql`
      insert into usage_daily (date, product, event, count, sum_duration_ms, sum_bytes, distinct_users)
      select ${date}::date, coalesce(product, ''), event, count(*)::int, coalesce(sum(duration_ms), 0), coalesce(sum(bytes), 0),
             count(distinct user_public_id)::int
      from usage_events where at >= ${from} and at < ${to} group by 2, 3`);
  });
}

/** PV-05: usage events older than 24 months are deleted; rollups are kept. */
export async function purgeOldEvents(now = new Date()) {
  const db = await getAdminWriter();
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  await db.execute(sql`delete from usage_events where at < ${cutoff}`);
}

// The rollup writes, so it uses the main connection (the job runs as the app, not admin_reader).
async function getAdminWriter() {
  const { getDb } = await import("../client");
  return getDb();
}

export async function dailyRollups(p: Period) {
  return rows<{ date: string; product: string; event: string; count: number; sum_duration_ms: number; sum_bytes: number; distinct_users: number }>(sql`
    select date::text as date, product, event, count, sum_duration_ms, sum_bytes, distinct_users
    from usage_daily where date >= ${p.from}::date and date <= ${p.to}::date order by date, product, event`);
}
