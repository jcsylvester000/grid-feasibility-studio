-- Admin views (BRD 11.3 PV-01). The admin pages read only these views and usage_daily through the
-- admin_reader role (scripts/admin-reader-role.sql). No usernames, hashes, titles, inputs, outputs or
-- file names appear in any of them (PV-02).
CREATE OR REPLACE VIEW "admin_users_v" AS
  SELECT "public_id", "role", "status", "created_at", "last_active_at" FROM "users";
--> statement-breakpoint
CREATE OR REPLACE VIEW "admin_usage_v" AS
  SELECT "id", "user_public_id", "event", "product", "pipeline_id", "duration_ms", "bytes", "status", "error_code", "at" FROM "usage_events";
--> statement-breakpoint
CREATE OR REPLACE VIEW "admin_runs_v" AS
  SELECT r."id", u."public_id" AS "user_public_id", r."product", r."pipeline_id", r."status", r."phase", r."attempt",
         r."error_code", r."http_status", r."vs_run_id", r."duration_ms", r."input_bytes", r."output_bytes",
         r."queued_at", r."started_at", r."finished_at"
  FROM "runs" r
  JOIN "reports" rep ON rep."id" = r."report_id"
  JOIN "users" u ON u."id" = rep."user_id";
--> statement-breakpoint
CREATE OR REPLACE VIEW "admin_storage_v" AS
  SELECT u."public_id" AS "user_public_id", count(f."id")::int AS "files", coalesce(sum(f."size_bytes"), 0)::bigint AS "bytes"
  FROM "users" u
  LEFT JOIN "reports" rep ON rep."user_id" = u."id"
  LEFT JOIN "files" f ON f."report_id" = rep."id"
  GROUP BY u."public_id";
