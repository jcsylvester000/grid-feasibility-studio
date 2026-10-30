/**
 * Read-only check: how many times each report called the live VectorShift pipeline.
 * Run:  node scripts/runs-audit.mjs   (reads DATABASE_URL from .env.local; prints no secrets; changes nothing)
 */
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const sql = neon(env.DATABASE_URL);
const live = `pipeline_id not like 'mock-%' and pipeline_id not like 'demo-%'`;

const totals = await sql.query(`select count(*)::int as runs,
  count(*) filter (where attempt = 1)::int as first_attempts,
  count(*) filter (where attempt > 1)::int as automatic_retries,
  count(*) filter (where vs_run_id is not null)::int as reached_vectorshift
  from runs where ${live}`);
console.log("\nLIVE VectorShift runs, totals:");
console.table(totals);

console.log("Automatic retries (each one = a second VectorShift call for the same Generate):");
console.table(await sql.query(`select to_char(r2.queued_at at time zone 'Asia/Manila','YYYY-MM-DD HH24:MI') as retry_at_manila,
  r1.error_code as first_failed_with, r2.status as retry_status, coalesce(r2.error_code,'') as retry_error
  from runs r2 join runs r1 on r1.report_id = r2.report_id and r1.attempt = 1 and r1.queued_at < r2.queued_at
  where r2.attempt > 1 and r2.pipeline_id not like 'mock-%' and r2.pipeline_id not like 'demo-%'
  order by r2.queued_at desc`));

console.log("Live runs by day and result (Manila time):");
console.table(await sql.query(`select to_char(queued_at at time zone 'Asia/Manila','YYYY-MM-DD') as day, status, coalesce(error_code,'') as error,
  count(*)::int as runs from runs where ${live} group by 1,2,3 order by 1 desc, 2`));
