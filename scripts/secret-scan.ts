/**
 * B9-06 secret scan (SE-02, SE-06): fails when a credential is found in files that git would commit, or
 * when a server-only variable name or secret shows up in the browser bundles (.next/static).
 *   npm run scan:secrets
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PATTERNS: [string, RegExp][] = [
  ["Postgres URL with a password", /postgres(?:ql)?:\/\/[^\s:'"`/]+:([^\s@'"`]{8,})@/g],
  ["Neon password", /\bnpg_[A-Za-z0-9]{10,}\b/g],
  ["UploadThing secret key", /\bsk_live_[A-Za-z0-9]{16,}\b/g],
  ["UploadThing token", /\beyJhcGlLZXkiOi[A-Za-z0-9+/=]{20,}/g],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g],
  ["Bearer token in code", /Bearer\s+[A-Za-z0-9_\-.]{32,}/g],
];
const PLACEHOLDER = /(USER|PASSWORD|CHANGE-ME|example|placeholder|xxxx|\$\{)/i;
const SERVER_ONLY_NAMES = ["DATABASE_URL", "UPLOADTHING_TOKEN", "UPLOADTHING_SECRET", "VECTORSHIFT_API_KEY", "APP_SECRET", "INTERNAL_DISPATCH_SECRET"];

function trackedFiles(): string[] {
  try {
    return execSync("git ls-files -co --exclude-standard", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
  } catch {
    const out: string[] = [];
    const skip = new Set(["node_modules", ".next", ".git", ".sync", ".data", "test-results", "playwright-report", ".netlify"]);
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name) || name.startsWith(".env") && name !== ".env.example") continue;
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else out.push(path.relative(process.cwd(), p));
      }
    };
    walk(process.cwd());
    return out;
  }
}

const findings: string[] = [];
for (const file of trackedFiles()) {
  if (/\.(png|jpe?g|webp|heic|pdf|woff2?|ico|zip|gz|mp4|mov)$/i.test(file) || !existsSync(file)) continue;
  if (/^\.env(\.|$)/.test(path.basename(file)) && path.basename(file) !== ".env.example") {
    findings.push(`${file}: environment file would be committed`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const [label, re] of PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (PLACEHOLDER.test(m[0]) || file === "scripts/secret-scan.ts") continue;
      findings.push(`${file}: ${label} (${m[0].slice(0, 12)}…)`);
    }
  }
}

const staticDir = ".next/static";
if (existsSync(staticDir)) {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n)) : [path.join(dir, n)]));
  const secrets = SERVER_ONLY_NAMES.map((n) => process.env[n]).filter((v): v is string => !!v && v.length >= 12);
  for (const f of walk(staticDir).filter((f) => f.endsWith(".js"))) {
    const text = readFileSync(f, "utf8");
    for (const n of SERVER_ONLY_NAMES) if (text.includes(n)) findings.push(`${f}: browser bundle mentions ${n}`);
    for (const v of secrets) if (text.includes(v)) findings.push(`${f}: browser bundle contains a secret value`);
  }
}

if (findings.length) {
  console.error(`Secret scan failed (${findings.length}):\n- ${findings.join("\n- ")}`);
  process.exit(1);
}
console.log("Secret scan clean.");
