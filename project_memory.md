# GravHub — Project Memory

Living notes for picking this project back up across sessions. Not a status
report or roadmap (`DEVELOPMENT_PLAN.md`/`STRATEGIC_ROADMAP.md` are dated
snapshots of those) — this is the stuff that's easy to re-learn the hard way
if it isn't written down. Edit this file directly as things change; nothing
here is generated output.

## Environment constraints

- This sandbox has **no live Supabase credentials** — no `.env.local`, no
  `SUPABASE_SERVICE_ROLE_KEY`. All live-database changes get handed to the
  user as SQL to run themselves in the Supabase SQL Editor; they report back
  "Success" or paste the error, and get a fix. Never fabricate a workaround
  around this — check `env | grep SUPABASE` / `.env.local` presence before
  assuming otherwise.
- **No live Supabase Storage access either.** Storage-level changes (moving
  files between folders, etc.) get handed off as a standalone Node script
  the user runs locally with their own `SUPABASE_SERVICE_ROLE_KEY` — the
  Supabase MCP's SQL tools can't touch Storage objects.
- The Supabase MCP connector appears/disappears across sessions and its
  tools have previously required an approval that wasn't grantable
  mid-session (`MCP error -32003`). Don't assume live DB access is available
  just because the tools are listed — confirm with a trivial read first, and
  don't force a blocked call through.

## Data model gotchas (learned the hard way)

- **Two task systems, only one is real.** `app_tasks` is the actual
  standalone tasks table (department + service-line visibility scoping,
  read by `/tasks` and each project's `/projects/[id]` board via
  `?projectId=`). `projects.tasks` (JSONB column) is **dead** — set to `[]`
  at creation, never rendered anywhere in the UI (confirmed via AUDIT
  `#117`/`#227` and by reading `app/projects/[id]/page.tsx` and
  `app/crm/companies/page.tsx`'s `CompanyPanel` directly — neither reads
  `.tasks` off a project). Always write real tasks into `app_tasks` with
  `project_id` set. Don't trust "tasks show under the company/project page"
  claims without checking which of the two systems actually renders.
- **Schema drift**: migration files exist in `supabase/migrations/*.sql`
  that were written but never applied to the live DB (e.g.
  `add_projects_service_types.sql` for `projects.service_types`). Check that
  directory for a ready-made fix before hand-writing new SQL from scratch —
  it's happened more than once that the exact fix was already sitting there.
- **Service catalog**: `lib/services.ts`'s `SERVICES_RAW`/`SERVICE_NAMES` is
  the single source of truth for service names across deals/projects/
  proposals/contracts/tasks — don't hardcode a service list anywhere else.
  `service_type` (singular) + `service_types` (plural, `text[]`) both exist
  on `projects`/`deals` for multi-service support; `service_type` should
  always be `service_types[0]` for back-compat.
- **Company identity is inconsistent across tables.** `crm_companies.id` is
  the collision-proof key. Several tables (`projects.company`,
  `app_tasks.company`) instead use the free-text company *name*, exact-string
  matched in places like `CompanyPanel`'s
  `projects.find(p => p.company === company.name)`. Prefer resolving by name
  → `crm_companies.id` server-side (see `lib/file-storage.ts`'s
  `resolveFolder()` for the pattern) over threading `companyId` through
  every frontend call site.

## Established workflow conventions

- SQL handed to the user: always idempotent (`WHERE NOT EXISTS`,
  `ON CONFLICT DO NOTHING`), wrapped in `BEGIN;`/`COMMIT;`, with a header
  comment stating scope and what's deliberately excluded and why.
- Paste SQL directly in the chat message, not just as a file attachment —
  established preference this session.
- Don't fabricate financial/contractual data (contract dollar values, signed
  dates) — flag it as a separate, more careful pass instead of guessing.
- Real product/scope decisions go through `AskUserQuestion`, not a
  unilateral build. Findings that need a schema change, new infra, or a
  cost/product call get logged `Needs Decision` in `AUDIT.md` instead of
  being built silently.
- Verify every code change with `npx tsc --noEmit -p .`, `npx eslint`, and
  `npx vitest run` before committing — this repo's CI expects all three
  clean.

## Current business-data import state (as of 2026-08-01)

- ~30 real Graviss Marketing clients imported into `crm_companies` from an
  Asana export + the "Master Client Register" document.
- 55 real Asana tasks live in `app_tasks` with `project_id` set (migrated
  off the dead `projects.tasks` JSONB — see "Two task systems" above).
- Deliberately deferred, not done: Master Client Register Part 7
  contract $ amounts/dates (only BMV Service Pro and ADCO Outdoor have real
  numbers documented in the register; the rest would be guesses); 6
  archived/inactive companies (Greenville Outdoors, Street Smart Media, Big
  Dog Partners Hardware, Midha Realty, Neighborhood TV, Lead Outdoor)
  intentionally excluded per "old or finished, do not add."

## Recently shipped this session

- Multi-service support on Projects — checkboxes in the New Project and
  Project Settings modals, `serviceTypes[]` wired through create/edit/
  display end to end.
- Added `GEO` as a selectable service, bundled under SEO/AEO with no
  separate pricing tier (user decision).
- Service-line task visibility: a task tagged with a Service Line is
  private to its assignee; leaving it unset keeps the task "open" under the
  existing department-sharing rule. Leadership/Super Admin/Department
  Manager/admins are unrestricted.
- Fixed AUDIT `#584` (cross-tenant file-storage collision) —
  `lib/file-storage.ts`'s `resolveFolder()` keys the `client-files` bucket
  path off `crm_companies.id` instead of a lossy sanitized-name slug, with a
  dual-read fallback to the legacy folder until the (separately delivered)
  storage migration script actually runs.

## Where to look first

- `AUDIT.md` — the real bug/finding tracker, maintained by `/audit` runs.
  Check it before re-investigating something that might already be logged.
- `supabase/schema.sql` — canonical schema, but verify against the live DB
  before trusting it fully (see schema-drift note above).
- `CLAUDE.md` — session/tooling instructions (skills, gstack conventions).
