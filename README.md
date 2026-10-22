# GRID Feasibility Studio

Web app that runs GRID's four feasibility products (Quick Report, Executive Summary, Feasibility Report,
Teaser Scan) as VectorShift pipelines. Spec: **BRD v2.0, GRID Feasibility Studio on VectorShift (22 Oct 2026)**.
Build plan and checklist: *GRID Feasibility Studio - Build Game Plan.docx* and *Build Tracker.xlsx*.

Stack: Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · Neon Postgres + Drizzle ·
UploadThing · VectorShift API · Netlify.

## Run it on your computer (Windows PowerShell, one line at a time)

Needs Node.js 20.9 or later (`node -v`) and Git (`git --version`).

```powershell
cd "C:\Users\jcsyl\Desktop\Website Enhancement Agency\5 - Final Application\Grid Feasibility Studio"
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000. For report runs, start the mock VectorShift in a **second** PowerShell window:

```powershell
cd "C:\Users\jcsyl\Desktop\Website Enhancement Agency\5 - Final Application\Grid Feasibility Studio"
npm run mock:vs
```

Secrets live in `.env.local` (git-ignored). `.env.example` lists every variable without values.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run db:migrate` | Applies SQL migrations in `drizzle/` to the database in `.env.local` |
| `npm run db:generate` | Creates a new migration after editing `lib/db/schema.ts` |
| `npm run mock:vs` | Mock VectorShift on http://localhost:4010 (scenarios: pipeline id `mock-<product>--<scenario>`) |
| `npm run typegen` | Regenerates `lib/contract/types.gen.ts` from the JSON schemas |
| `npm test` | Unit, contract and integration tests (in-memory Postgres, no network) |
| `npm run e2e` | Playwright end-to-end tests (run `npm run build` first; `npx playwright install chromium` once) |
| `npm run lint` · `npm run typecheck` | ESLint and TypeScript checks |
| `npm run scan:secrets` · `npm run audit:prod` | Secret scan (repository and browser bundles) · production dependency audit |
| `npm run admin:create -- --username <name>` | Creates an admin account (password and key printed once) |
| `npm run demo:seed -- --username <name>` | Loads the 20 demo scenarios into an account (or use the dashboard button in development / DEMO_MODE) |

## Layout

```
app/                 pages and route handlers (public, auth, app, admin, api)
components/ui/       buttons, cards, badges (shadcn pattern, GRID tokens)
lib/contract/        GRID JSON schemas (byte-identical to the blueprint), Ajv validation, generated types
lib/db/              Drizzle schema and client (repositories added from B2)
lib/env.ts           server-only environment, validated on first use
mock/vectorshift/    mock VectorShift server and golden payloads (C6 Calzada-Tipas)
netlify/functions/   run-worker (background, 15 min), usage-rollup and file-cleanup (scheduled)
drizzle/             SQL migrations
tests/               unit, contract, integration (PGlite) and e2e (Playwright)
```

## Deploying and running

- [docs/DEPLOY.md](docs/DEPLOY.md): Netlify site, environment variables, secret rotation, live VectorShift.
- [docs/RUNBOOK.md](docs/RUNBOOK.md): everyday tasks, support actions, release checks, privacy rules.

Not a licensed appraisal, engineering, legal, tax or financial opinion.
