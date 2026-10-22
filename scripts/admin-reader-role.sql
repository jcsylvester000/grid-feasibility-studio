-- BRD 11.3 PV-01: the admin pages connect as admin_reader, which can read the admin views and the daily
-- rollup only. It cannot read users, reports, files, envelopes or any other table.
-- Run once on Neon (SQL Editor, as the project owner), replacing the password, then put the connection
-- string in DATABASE_URL_ADMIN_READER (same host, user admin_reader).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_reader') THEN
    CREATE ROLE admin_reader LOGIN PASSWORD 'CHANGE-ME-to-a-long-random-password';
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM admin_reader;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM admin_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM admin_reader;
GRANT USAGE ON SCHEMA public TO admin_reader;
GRANT SELECT ON admin_users_v, admin_usage_v, admin_runs_v, admin_storage_v, usage_daily TO admin_reader;
