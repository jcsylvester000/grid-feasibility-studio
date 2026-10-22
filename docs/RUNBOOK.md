# GRID Feasibility Studio: runbook and handover (B10-07)

## What runs where

| Part | Where | Notes |
| --- | --- | --- |
| Web app and API | Netlify (Next.js 16, Node 22) | `app/` pages and `/api` route handlers |
| Report runs | Netlify Background Function `run-worker` | 15-minute limit; one VectorShift call per run |
| Nightly jobs | `usage-rollup` 02:00 Manila, `file-cleanup` 02:30 Manila | Scheduled Functions |
| Database | Neon Postgres (Singapore) | Drizzle migrations in `drizzle/` |
| Files | UploadThing (sea1, private) | 5-minute signed URLs; deleted 90 days after last use |
| Pipelines | VectorShift | One pipeline per product; contract in `lib/contract/schemas/` |

## Everyday tasks

- **Add or rename a dropdown option**: edit `lib/options/catalog/<product>.json` (field dictionary format;
  keep `value` stable, change `label` freely). The forms, validation and the pipeline's field dictionary all
  read from it. Run `npm test` and deploy. A new lot-area band needs no prompt change (TS-AC-07).
- **Update a pipeline**: publish the new version in VectorShift. If its id changes, update
  `VS_PIPELINE_<PRODUCT>` in Netlify and redeploy. If the output schema changes, replace the files in
  `lib/contract/schemas/`, run `npm run typegen` and `npm test`.
- **Support a user who lost the password and the recovery key**: Admin → Users → search the User ID they
  give you → Issue reset code. The code shows once and is valid 24 hours; the action is audited.
- **Suspend or reactivate a user**: Admin → Users → User ID → Suspend. Their sessions end immediately.
- **A run failed**: Admin → Runs → filter Failed → open the run. The panel shows the error code, HTTP status
  and VectorShift run id (no report content). Give the VectorShift run id to VectorShift support.
- **Pipelines look slow**: Admin → Pipelines. A warning appears when p95 is above 80% of the timeout or the
  7-day success rate is under 95%.
- **Turn the Teaser Scan on**: set `FEATURE_TEASER_SCAN=true` and `VS_PIPELINE_TEASER_INTAKE`, redeploy.

## Checks before every release

```powershell
npm run lint; npm run typecheck; npm test
npx next build; npm run check:budgets; npm run scan:secrets; npm run audit:prod
npx playwright test
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same checks on every push.

## Privacy rules (BRD 11.3)

- Admin pages read views only (`admin_*_v`, `usage_daily`) through the `admin_reader` role. No username,
  title, input, report content or file name is ever shown to admins; a test scans every admin page and CSV.
- Usage events keep only the public User ID and are deleted after 24 months; daily rollups stay.
- Deleting an account deletes the user row (with the username), reports, runs and files.

## Known decisions and open items

See the tracker (Open Questions, Risks) and the project ledger. Main ones: PF-03 JavaScript budgets
(framework baseline is about 150 KB on public pages), the run_request contract gaps (WebP and video mime
types, the teaser_intake product value, the callback field), the Quick Report percent convention, real
VectorShift payloads (Q-09), counsel review of the Terms and Privacy Notice, and the DPO contact.
