import "server-only";
import { z } from "zod";

/**
 * Server-only environment, validated lazily (W20 step 3): importing this module never throws,
 * so `next build` works without secrets. Code that needs a value calls env() at request time.
 * Never import this from a client component (VS-08, SE-02).
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  DATABASE_URL_ADMIN_READER: z.string().optional(),
  DB_DRIVER: z.enum(["neon", "pglite"]).default("neon"),
  UPLOADTHING_TOKEN: z.string().optional(),
  VECTORSHIFT_API_KEY: z.string().optional(),
  VECTORSHIFT_BASE_URL: z.string().url().default("https://api.vectorshift.ai"),
  VS_PIPELINE_QUICK_REPORT: z.string().optional(),
  VS_PIPELINE_EXECUTIVE_SUMMARY: z.string().optional(),
  VS_PIPELINE_FEASIBILITY_REPORT: z.string().optional(),
  VS_PIPELINE_TEASER_INTAKE: z.string().optional(),
  VS_TIMEOUT_MS_QUICK_REPORT: z.coerce.number().int().positive().optional(),
  VS_TIMEOUT_MS_EXECUTIVE_SUMMARY: z.coerce.number().int().positive().optional(),
  VS_TIMEOUT_MS_FEASIBILITY_REPORT: z.coerce.number().int().positive().optional(),
  VS_TIMEOUT_MS_TEASER_INTAKE: z.coerce.number().int().positive().optional(),
  VS_MAX_CONCURRENT: z.coerce.number().int().positive().default(10),
  RUN_DISPATCH: z.enum(["inline", "netlify"]).default("inline"),
  INTERNAL_DISPATCH_SECRET: z.string().optional(),
  FEATURE_TEASER_SCAN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  ADDRESS_HASH_SALT: z.string().optional(),
  ALLOW_INDEXING: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;
export type ProductKey = "QUICK_REPORT" | "EXECUTIVE_SUMMARY" | "FEASIBILITY_REPORT" | "TEASER_INTAKE";

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Names only; never print values.
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

/** Throws a clear message when a required value is missing (at request time, not at import). */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const v = env()[key];
  if (v === undefined || v === null || v === "") throw new Error(`Missing environment variable ${String(key)}`);
  return v as NonNullable<Env[K]>;
}

/** Test helper: forget the cached parse so tests can change process.env. */
export function resetEnvCache() {
  cached = null;
}
