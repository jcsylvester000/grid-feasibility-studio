-- citext was used for usernames until migration 0002 (now text + unique index on lower(username)).
-- Kept tolerant so databases without the extension (PGlite in tests) can still apply this migration.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS citext;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'citext not available; not needed after migration 0002';
END $$;
