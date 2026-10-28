# Deploying to Netlify and switching to live VectorShift (batch B10)

You do these steps by hand in the Netlify, Neon, UploadThing and VectorShift dashboards. Nothing here needs
code changes. Never paste secret values into the repository, a ticket or a chat.

## 1. Rotate the shared secrets first (B10-01)

The Neon password and the UploadThing key were shared in chat during the build. Replace them before the
first deploy:

1. **Neon** → your project → Roles → `neondb_owner` (or your role) → Reset password. Copy the new pooled and
   direct connection strings.
2. **UploadThing** → your app → API Keys → create a new key, then delete the old one. Copy the new
   `UPLOADTHING_TOKEN`.
3. Put the new values in your own `.env.local` too, then run `npm run dev` once to confirm.

## 2. Database (Neon, Singapore)

```powershell
npm run db:migrate          # applies every migration in drizzle/ (0000 to 0005)
npm run admin:create -- --username gridadmin   # first admin; prints a password and recovery key once
```

Admin read-only role (PV-01): open `scripts/admin-reader-role.sql`, replace `CHANGE-ME…` with a long random
password, run it in the Neon SQL Editor, then build `DATABASE_URL_ADMIN_READER` from your pooled connection
string with user `admin_reader` and that password.

## 3. UploadThing settings (B6-04)

- App region: `sea1` (already in your token).
- Settings → enable **private files** / ACL overrides (the routes ask for `acl: private`).
- Settings → allow **signed-URL expiry overrides** (the app asks for 5 minutes).
- Private files may need a paid plan. Until they are enabled, uploads fail with an ACL error.

## 4. Create the Netlify site (B10-02)

1. Netlify → Add new site → Import from GitHub → `jcsylvester000/grid-feasibility-studio`.
2. Build settings come from `netlify.toml` (command `npm run build:netlify`, Node 22, Next.js plugin).
3. Site configuration → Functions → region: **Singapore (ap-southeast-1)** if your plan offers it (near Neon).
4. Site configuration → Environment variables → add the variables below (scope: all, or Builds + Functions).
5. Deploy. The first build runs the migrations, so `DATABASE_URL_UNPOOLED` must be set.

### Environment variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (new password) |
| `DATABASE_URL_UNPOOLED` | Neon **direct** connection string (used by migrations at build time) |
| `DATABASE_URL_ADMIN_READER` | Connection string for `admin_reader` (step 2) |
| `DB_DRIVER` | `neon` |
| `UPLOADTHING_TOKEN` | New UploadThing token (step 1) |
| `UPLOAD_DRIVER` | `uploadthing` |
| `APP_ORIGIN` | Your site URL, e.g. `https://grid-feasibility-studio.netlify.app` (no trailing slash) |
| `APP_SECRET` | 48+ random characters (`node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"`) |
| `RUN_DISPATCH` | `netlify` (the default on Netlify; runs go to the background function, never an ordinary 26-30 second function) |
| `INTERNAL_DISPATCH_SECRET` | Another 48+ random characters |
| `VECTORSHIFT_BASE_URL` | Until the pipelines are ready, leave runs off (see step 6). Live: `https://api.vectorshift.ai` |
| `VECTORSHIFT_API_KEY` | VectorShift API key (step 6) |
| `VS_PIPELINE_QUICK_REPORT` | Pipeline id |
| `VS_PIPELINE_EXECUTIVE_SUMMARY` | Pipeline id |
| `VS_PIPELINE_FEASIBILITY_REPORT` | Pipeline id |
| `VS_PIPELINE_TEASER_INTAKE` | Pipeline id (only when the Teaser Scan is turned on) |
| `VS_TIMEOUT_MS_FEASIBILITY_REPORT` | Optional, at most `840000` (the Background Function limit is 15 minutes) |
| `VS_MAX_CONCURRENT` | `10` (raise only after checking VectorShift's limits) |
| `FEATURE_TEASER_SCAN` | `false` until GRID approves release 1b |
| `ALLOW_INDEXING` | `true` only for the production domain |
| `DESIGN_SAMPLES` | `false` (or leave unset) |
| `DEMO_MODE` | `true` only on a demo or staging site (shows "Load the 20 demo scenarios"); `false` in production |
| `DEMO_LOGIN` | Demo site only: a shared login as `username:password` (e.g. `TestUser1:…`), created on first sign-in. Needs `DEMO_MODE=true`. Remove before launch |
| `PROTOTYPE_MODE` | Optional. The prototype banner already shows while any product still runs on the stand-in, and names the live ones |
| `VS_INPUT_QUICK_REPORT` | Optional. `fields` (default: the live Quick Report pipeline's 21 named inputs) or `run_request` |
| `VS_BASE_URL_<PRODUCT>` | Optional. A different address for one product (e.g. keep a product on a test endpoint) |

Do not set `ALLOW_PGLITE`, `PGLITE_SEED_ADMIN` or `UPLOAD_LOCAL_DIR` on Netlify; they are for tests only.

## 5. Check the functions (B10-03)

- Netlify → Functions: `run-worker` (background), `usage-rollup` (daily 18:00 UTC = 02:00 Manila) and
  `file-cleanup` (daily 18:30 UTC) are listed.
- Use "Run now" on the two scheduled functions once and check the logs for `{"job":"usage-rollup"…}` and
  `{"job":"file-cleanup"…}`.
- `https://<site>/api/health` returns `{"ok":true,"database":"ok",…}`.

## 6a. Quick Report on live VectorShift (28 Oct 2026)

The Quick Report pipeline is live. In Netlify set:

| Variable | Value |
| --- | --- |
| `VECTORSHIFT_BASE_URL` | `https://api.vectorshift.ai` |
| `VECTORSHIFT_API_KEY` | The VectorShift API key (secret; Netlify only, never in the repository) |
| `VS_PIPELINE_QUICK_REPORT` | `6adefcd965509b4158a2f6de` |
| `RUN_DISPATCH` | `netlify` |
| `INTERNAL_DISPATCH_SECRET` | 48+ random characters (required for the background function) |

Then redeploy. The first build runs migration `0006_run_input_snapshot` (adds `runs.input_snapshot`).
Executive Summaries and Feasibility Reports keep their pipeline ids; until those pipelines exist, runs of
those products fail with a clear message, and the prototype banner says they are not live yet.

How a run works: Generate → the app records the answers on a new run → the background function calls
VectorShift (a Quick Report takes under 30 seconds; the call may wait up to 14 minutes) → the result is
stored in Neon → the run page, which polls every few seconds, opens the report. Every run is kept as a
version; "Edit inputs and run again" adds a version and never overwrites one.

## 6. Switch to live VectorShift (B10-04, B10-05), when the payloads are ready

1. Send the real pipeline output payloads; the viewer tests are re-run against them (tracker Q-09).
2. In VectorShift, each pipeline needs: input `run_request` (text), file inputs `file_1` to `file_10`
   (Executive Summary, Feasibility Report, Teaser Scan) and output `result_envelope` (BRD 7.2).
3. Set `VECTORSHIFT_BASE_URL=https://api.vectorshift.ai`, the API key and the four pipeline ids, then
   redeploy.
4. Run 10 of each product and record p50 and p95 time, output size and errors in the tracker. The admin
   Pipelines page shows these figures; it warns when p95 is above 80% of the timeout.

## 7. Smoke test (B10-06)

Register → save the recovery key → Quick Report → Generate → view → print to PDF → log out → reset with the
key → admin overview shows the user by User ID only. Then user acceptance testing with GRID.

## Rolling back

Netlify → Deploys → pick the last good deploy → "Publish deploy". Migrations only add tables, columns and
views, so an older build still works with a newer database.
