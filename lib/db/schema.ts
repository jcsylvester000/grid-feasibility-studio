/**
 * Database schema (BRD v2.0 section 14). Drizzle ORM, PostgreSQL (Neon).
 * All foreign keys cascade from users and reports, so deleting an account removes everything (14.2).
 * usage_events and audit_log hold only public User IDs, never foreign keys, so they survive
 * account deletion unlinked (PV-04).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const USER_ROLES = ["user", "admin"] as const;
export const USER_STATUSES = ["active", "suspended"] as const;
export const PRODUCTS = ["quick_report", "executive_summary", "feasibility_report", "teaser_intake"] as const;
export const REPORT_STATUSES = ["draft", "queued", "running", "ready", "failed", "needs_confirmation"] as const;
export const RUN_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
/** Run status page steps (BRD S-04): the first two and last two are real app states. */
export const RUN_PHASES = ["request_sent", "files_attached", "pipeline_working", "checking", "done"] as const;
export type RunPhase = (typeof RUN_PHASES)[number];

export const AUTH_ATTEMPT_KINDS = ["login", "login_address", "register", "availability"] as const;

export type Product = (typeof PRODUCTS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Usernames are unique regardless of case (AU-01) through a unique index on lower(username).
 * (Originally citext; changed in migration 0002 so the same schema runs on Neon and on PGlite.)
 * Look users up with lower() (see lib/db/repos/users.ts).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicId: text("public_id").notNull().unique(),
  username: text("username").notNull(),
  displayUsername: text("display_username").notNull(),
  passwordHash: text("password_hash").notNull(),
  recoveryKeyHash: text("recovery_key_hash").notNull(),
  role: text("role", { enum: USER_ROLES }).notNull().default("user"),
  status: text("status", { enum: USER_STATUSES }).notNull().default("active"),
  termsVersion: text("terms_version").notNull(),
  privacyVersion: text("privacy_version").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastActiveAt: ts("last_active_at"),
}, (t) => [uniqueIndex("users_username_lower_unique").on(sql`lower(${t.username})`)]);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    absoluteExpiresAt: ts("absolute_expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind", { enum: AUTH_ATTEMPT_KINDS }).notNull(),
    keyHash: text("key_hash").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("auth_attempts_lookup_idx").on(t.kind, t.keyHash, t.at), index("auth_attempts_at_idx").on(t.at)],
);

export const resetCodes = pgTable(
  "reset_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    issuedByPublicId: text("issued_by_public_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
  },
  (t) => [index("reset_codes_user_idx").on(t.userId)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    product: text("product", { enum: PRODUCTS }).notNull(),
    title: text("title").notNull().default("Untitled report"),
    intake: jsonb("intake").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("draft"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("reports_user_updated_idx").on(t.userId, t.updatedAt)],
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    product: text("product", { enum: PRODUCTS }).notNull(),
    pipelineId: text("pipeline_id").notNull(),
    vsRunId: text("vs_run_id"),
    status: text("status", { enum: RUN_STATUSES }).notNull().default("queued"),
    phase: text("phase", { enum: RUN_PHASES }).notNull().default("request_sent"),
    errorCode: text("error_code"),
    attempt: integer("attempt").notNull().default(1),
    httpStatus: integer("http_status"),
    inputBytes: integer("input_bytes"),
    outputBytes: integer("output_bytes"),
    durationMs: integer("duration_ms"),
    progressLog: text("progress_log"),
    queuedAt: ts("queued_at").notNull().defaultNow(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    retryAt: ts("retry_at"),
    rawFailureBody: jsonb("raw_failure_body"),
    rawFailureExpiresAt: ts("raw_failure_expires_at"),
  },
  (t) => [
    index("runs_status_started_idx").on(t.status, t.startedAt),
    index("runs_report_idx").on(t.reportId),
    // Only one run per report may be queued or running (BRD 14.1).
    uniqueIndex("runs_one_active_per_report")
      .on(t.reportId)
      .where(sql`status in ('queued', 'running')`),
  ],
);

export const envelopes = pgTable("envelopes", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => runs.id, { onDelete: "cascade" }),
  schemaVersion: text("schema_version").notNull(),
  product: text("product", { enum: PRODUCTS }).notNull(),
  envelope: jsonb("envelope").$type<Record<string, unknown>>().notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    utKey: text("ut_key").notNull().unique(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    /** What the document is (title_documents, zoning_certificate, ...; field dictionary docs.* keys), or null. */
    docType: text("doc_type"),
    createdAt: ts("created_at").notNull().defaultNow(),
    deleteAfter: ts("delete_after").notNull(),
  },
  (t) => [index("files_report_idx").on(t.reportId), index("files_delete_after_idx").on(t.deleteAfter)],
);

/** UploadThing keys whose deletion failed and must be retried (14.2: deletions queued and retried). */
export const pendingFileDeletions = pgTable("pending_file_deletions", {
  utKey: text("ut_key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const usageEvents = pgTable(
  "usage_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userPublicId: text("user_public_id").notNull(),
    event: text("event").notNull(),
    product: text("product"),
    pipelineId: text("pipeline_id"),
    durationMs: integer("duration_ms"),
    bytes: bigint("bytes", { mode: "number" }),
    status: text("status"),
    errorCode: text("error_code"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [
    index("usage_events_at_idx").on(t.at),
    index("usage_events_user_at_idx").on(t.userPublicId, t.at),
    index("usage_events_event_at_idx").on(t.event, t.at),
  ],
);

export const usageDaily = pgTable(
  "usage_daily",
  {
    date: date("date", { mode: "string" }).notNull(),
    product: text("product").notNull().default(""),
    event: text("event").notNull(),
    count: integer("count").notNull().default(0),
    sumDurationMs: bigint("sum_duration_ms", { mode: "number" }).notNull().default(0),
    sumBytes: bigint("sum_bytes", { mode: "number" }).notNull().default(0),
    distinctUsers: integer("distinct_users").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.date, t.product, t.event] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    adminPublicId: text("admin_public_id").notNull(),
    action: text("action").notNull(),
    targetPublicId: text("target_public_id"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);
