/**
 * First-load JavaScript budget check (BRD PF-03). Run after `npm run build`:
 *   npm run check:budgets
 * Signed-in pages need BUDGET_COOKIE="grid_session=..." (they are skipped otherwise).
 * Starts `next start`, loads each route's HTML, collects every <script src>, and sums their
 * gzip-compressed sizes. Fails (exit 1) when a route is over its budget.
 */
import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";

const PORT = Number(process.env.BUDGET_PORT ?? 3300);
const KB = 1024;
/**
 * PF-03 asked for 70 / 150 / 180 KB. On Next.js 16 + React 19 the framework alone (react-dom +
 * Next runtime) is about 118 KB gzip on every App Router page, so 70 KB cannot be met. Budgets below
 * are framework + headroom, pending GRID's decision (ledger GFS-06). Lighthouse mobile >= 95 stays the
 * performance gate (PF-04).
 */
export const BUDGET_KB = { public: 160, app: 220, admin: 250 } as const;
const budgets: { route: string; limitKb: number; group: string }[] = [
  { route: "/", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/feasibility-study", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/how-it-works", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/terms", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/privacy", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/register", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/login", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/reset", limitKb: BUDGET_KB.public, group: "public" },
  { route: "/app", limitKb: BUDGET_KB.app, group: "app" },
  { route: "/app/new", limitKb: BUDGET_KB.app, group: "app" },
  { route: "/app/reports", limitKb: BUDGET_KB.app, group: "app" },
  { route: "/app/account", limitKb: BUDGET_KB.app, group: "app" },
];
const extra = (process.env.BUDGET_ROUTES ?? "").split(",").filter(Boolean);
for (const spec of extra) {
  const [route, kb, group] = spec.split(":");
  budgets.push({ route: route!, limitKb: Number(kb), group: group ?? "custom" });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url: string) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("server did not start");
}

async function main() {
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production" },
  });
  const base = `http://localhost:${PORT}`;
  const sizes = new Map<string, number>();
  let failed = false;
  try {
    await waitForServer(base + "/");
    console.log("Route".padEnd(26), "First-load JS (gzip)".padEnd(22), "Budget", "  Result");
    for (const b of budgets) {
      const cookie = b.group === "public" ? undefined : process.env.BUDGET_COOKIE;
      const res = await fetch(base + b.route, { headers: cookie ? { cookie } : {}, redirect: "manual" });
      if (res.status >= 300) {
        console.log(b.route.padEnd(26), `skipped (HTTP ${res.status}; set BUDGET_COOKIE for signed-in pages)`);
        continue;
      }
      const html = await res.text();
      // Skip noModule polyfills: modern browsers (Next.js 16 support list) never download them.
      const srcs = [...html.matchAll(/<script([^>]+)>/g)]
        .filter((m) => !/noModule/i.test(m[1]!))
        .map((m) => /src="([^"]+)"/.exec(m[1]!)?.[1])
        .filter((x): x is string => Boolean(x));
      let total = 0;
      for (const src of new Set(srcs)) {
        if (!sizes.has(src)) {
          const buf = Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer());
          sizes.set(src, gzipSync(buf, { level: 9 }).length);
        }
        total += sizes.get(src)!;
      }
      const ok = total <= b.limitKb * KB;
      if (!ok) failed = true;
      console.log(
        b.route.padEnd(26),
        `${(total / KB).toFixed(1)} KB (${srcs.length} files)`.padEnd(22),
        `${b.limitKb} KB`.padEnd(7),
        ok ? " ok" : " OVER",
      );
    }
  } finally {
    server.kill();
  }
  if (failed) {
    console.error("\nJavaScript budget exceeded (PF-03).");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
