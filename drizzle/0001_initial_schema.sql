CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_public_id" text NOT NULL,
	"action" text NOT NULL,
	"target_public_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"key_hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "envelopes" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"schema_version" text NOT NULL,
	"product" text NOT NULL,
	"envelope" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"ut_key" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delete_after" timestamp with time zone NOT NULL,
	CONSTRAINT "files_ut_key_unique" UNIQUE("ut_key")
);
--> statement-breakpoint
CREATE TABLE "pending_file_deletions" (
	"ut_key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product" text NOT NULL,
	"title" text DEFAULT 'Untitled report' NOT NULL,
	"intake" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reset_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"issued_by_public_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"product" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"vs_run_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"http_status" integer,
	"input_bytes" integer,
	"output_bytes" integer,
	"duration_ms" integer,
	"progress_log" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"retry_at" timestamp with time zone,
	"raw_failure_body" jsonb,
	"raw_failure_expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"date" date NOT NULL,
	"product" text DEFAULT '' NOT NULL,
	"event" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"sum_duration_ms" bigint DEFAULT 0 NOT NULL,
	"sum_bytes" bigint DEFAULT 0 NOT NULL,
	"distinct_users" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_daily_date_product_event_pk" PRIMARY KEY("date","product","event")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_public_id" text NOT NULL,
	"event" text NOT NULL,
	"product" text,
	"pipeline_id" text,
	"duration_ms" integer,
	"bytes" bigint,
	"status" text,
	"error_code" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"username" "citext" NOT NULL,
	"display_username" text NOT NULL,
	"password_hash" text NOT NULL,
	"recovery_key_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"terms_version" text NOT NULL,
	"privacy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "users_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reset_codes" ADD CONSTRAINT "reset_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "auth_attempts_lookup_idx" ON "auth_attempts" USING btree ("kind","key_hash","at");--> statement-breakpoint
CREATE INDEX "auth_attempts_at_idx" ON "auth_attempts" USING btree ("at");--> statement-breakpoint
CREATE INDEX "files_report_idx" ON "files" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "files_delete_after_idx" ON "files" USING btree ("delete_after");--> statement-breakpoint
CREATE INDEX "reports_user_updated_idx" ON "reports" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "reset_codes_user_idx" ON "reset_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "runs_status_started_idx" ON "runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "runs_report_idx" ON "runs" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_one_active_per_report" ON "runs" USING btree ("report_id") WHERE status in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_events_at_idx" ON "usage_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "usage_events_user_at_idx" ON "usage_events" USING btree ("user_public_id","at");--> statement-breakpoint
CREATE INDEX "usage_events_event_at_idx" ON "usage_events" USING btree ("event","at");