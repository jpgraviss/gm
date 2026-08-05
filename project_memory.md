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
- **Schema drift**: migration files can exist in `supabase/migrations/*.sql`
  that were written but never applied to the live DB — `add_projects_
  service_types.sql` for `projects.service_types` was exactly this case
  (broke the v2 Asana-import SQL with a "column does not exist" error) and
  has since been confirmed applied by the user (2026-08-01) — don't assume
  it's still unapplied. Still, check that migrations directory for a
  ready-made fix before hand-writing new SQL from scratch when a similar
  "column doesn't exist" error shows up on a different table — it's
  happened more than once that the exact fix was already sitting there.
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

## Current business-data import state (as of 2026-08-02)

- ~30 real Graviss Marketing clients imported into `crm_companies` from an
  Asana export + the "Master Client Register" document. Confirmed run by
  the user (v1/v2/v3 scripts all reported back "Success").
- Deliberately deferred, not done: Master Client Register Part 7
  contract $ amounts/dates (only BMV Service Pro and ADCO Outdoor have real
  numbers documented in the register; the rest would be guesses); 6
  archived/inactive companies (Greenville Outdoors, Street Smart Media, Big
  Dog Partners Hardware, Midha Realty, Neighborhood TV, Lead Outdoor)
  intentionally excluded per "old or finished, do not add."

## Pending user action (delivered, not yet confirmed run)

- **`20260805120000_add_serpapi_settings_column.sql`** — adds
  `app_settings.serpapi jsonb`. Optional: with no SerpApi key configured the
  rank tracker falls back to Google Search Console exactly as before, so
  this is safe to apply whether or not the SERP provider is ever paid for.
  Until it runs, saving a SerpApi key in Admin → Integrations will fail.
- **`20260805130000_add_booking_type_owner.sql`** — adds
  `booking_types.owner_calendar_slug` (AUDIT #699). Until it runs, the
  calendar-sync loop still pushes every pending public booking to whichever
  staff Google Calendar processes first. **After applying, assign an owner
  to each booking type in the editor** — a NULL owner is deliberately
  skipped rather than falling back to the old random-calendar behavior.
- **`20260805140000_add_rate_limit_counters.sql`** — adds the
  `rate_limit_counters` table + `increment_rate_limit_counter()` RPC that
  back durable account lockout (AUDIT #722). Not urgent: `login-attempts.ts`
  keeps its in-process Map as a second layer, so until this runs, lockout
  degrades to exactly the old per-instance behavior rather than breaking.

- **`asana_import_v4_migrate_to_app_tasks.sql`** — moves the 55 Asana tasks
  out of the dead `projects.tasks` JSONB into real `app_tasks` rows with
  `project_id` set, so they actually render on each project's task board.
  Delivered to the user; no "Success"/error report back yet as of this
  writing. Until it's run, those 55 tasks are still sitting inert in
  `projects.tasks` — don't assume they're live in `app_tasks`.
- **`migrate_file_storage_to_company_id.mjs`** — standalone Node script
  (needs the user's real `SUPABASE_SERVICE_ROLE_KEY`, run outside this
  sandbox) that moves existing `client-files` Storage objects from their
  old sanitized-name folder to the new `company_id` folder. The *code* fix
  (AUDIT `#584`) is live and pushed regardless — new uploads are already
  correctly scoped, and list/download dual-read the legacy folder so
  nothing's invisible in the meantime — but pre-existing files stay under
  their old (collision-prone) path until this script actually runs.
- ~~**`add_deals_line_items.sql`**~~ — **confirmed run.** The user reported
  "success" on this one at the start of the following session, so
  `deals.line_items jsonb` is live and deal line items work end to end.

## Recently shipped this session

- **Full strategic + technical assessment** (user request: "comprehensive audit... know
  every detail... how to finish it"), scoped via `AskUserQuestion` to: internal tool for
  Graviss Marketing (SaaS-resale direction explicitly retired), build on `AUDIT.md`
  rather than re-hunting bugs, and — per an explicit follow-up instruction — a dedicated
  focus on whether modules actually connect to each other. Ran 8 parallel agent lanes (7
  by module + 1 cross-module integration lane) and rewrote `DEVELOPMENT_PLAN.md`
  (current-state assessment, replacing a stale April "99% functional" claim) and
  `STRATEGIC_ROADMAP.md` (phased forward plan, replacing the retired HubSpot/GoHighLevel
  competitive-SaaS framing). Headline finding: individual modules are unusually mature,
  but cross-module wiring is the real gap — Contract→Invoice has zero automation wiring
  at all, the Company Panel still filters Deals/Contracts/Invoices by name instead of
  `company_id`, the real client proposal-accept path doesn't auto-create a contract
  (only a rarely-used internal button does), Delivery/Operations and Client
  Support can't trigger automations at all, and the main dashboard is missing
  Projects/Tickets/Proposals/Marketing entirely. Also surfaced: no recurring/retainer
  invoice generation despite ~30 real contract clients (biggest Finance gap), no
  verified backup/DR process, Sentry code-complete but production-activation
  unconfirmed, and zero test coverage on `app/api/cron` (highest blast-radius file in
  the app). See `STRATEGIC_ROADMAP.md` for the full phased plan (Phase 0 data-safety →
  Phase 1 connect-the-modules → Phase 2 client-facing fixes → Phase 3 recurring billing
  → Phase 4 marketing channel completion → Phase 5 polish). Not yet built — this pass
  was audit + plan only, execution starts next per the user's direction.
- Full 8-agent audit sweep (CRM Core, Finance & Billing, Marketing &
  Automation, Client Portal & Learning, Admin/Settings/Auth, Operations,
  Data/AI & Misc, plus a dedicated adversarial-review agent on the last ~12
  commits including this session's own deal line-items feature). 19 new
  findings (`AUDIT.md` #703-721), 14 fixed directly — most notably:
  cancelled invoices were payable through the client portal with no
  server-side guard (checkout route + webhook both now reject them, not
  just the UI hiding a button); `NewTaskModal` defaulted "Assign To" to an
  arbitrary team member instead of the creator, so a self-tagged
  service-line task could silently lock its own creator out (same fix
  class as the existing time-tracking one, #364); 6 "legacy" automation
  actions (draft contracts, billing/renewal/escalation tasks, projects,
  maintenance records) were missing `company_id`, making auto-created
  records invisible on the originating company's own page; and several
  regressions the adversarial pass found in the deal line-items commit
  itself — a `.includes('geo')` substring bug misclassifying company names
  like "Georgia..." as an SEO service, a client/server negative-amount
  clamp mismatch, and the Companies page's new quick-create buttons
  hardcoding `companyId` instead of the form's actual selection. 5 left
  open as genuine feature-completion/product-decision work: Sales Training
  has no client self-enrollment path at all (High — a real gap, not a
  polish item), the renewals sidebar's monthly/total math needs the
  renewal's own term field traced first, AI-fallback labeling needs new
  UI, per-service revenue reporting needs a broader design for multi-service
  deals, and `NewProposalPanel` needs a `companyId` field added (a
  pre-existing, lower-risk sibling of the just-fixed New Deal/Contract
  bug). See `AUDIT.md`'s 2026-08-05 coverage note for the full breakdown.
- Multi-service support on Projects — checkboxes in the New Project and
  Project Settings modals, `serviceTypes[]` wired through create/edit/
  display end to end.
- Added `GEO` as a selectable service, bundled under SEO/AEO with no
  separate pricing tier (user decision).
- Service-line task visibility: a task tagged with a Service Line is
  private to its assignee; leaving it unset keeps the task "open" under the
  existing department-sharing rule. Leadership/Super Admin/Department
  Manager/admins are unrestricted (including the `'Dept Manager'` role
  alias, not just the long-form `'Department Manager'` string).
- Fixed AUDIT `#584` (cross-tenant file-storage collision) in code —
  `lib/file-storage.ts`'s `resolveFolder()` keys the `client-files` bucket
  path off `crm_companies.id` instead of a lossy sanitized-name slug. Data
  migration for existing files is still pending — see "Pending user action"
  below.
- Full coverage-gap audit sweep (7 agents) + a "just do the work" follow-up
  pass — 22 of 24 new findings fixed directly, including a HIGH `role`/
  `is_admin` desync between two admin surfaces (Settings vs Admin Panel)
  that could silently leave a demoted Super Admin with full admin access,
  and a CSRF block that likely broke the browser extension's Gmail
  tracking feature entirely since it shipped. `ClientIntegrationsPanel.tsx`
  now has real dropdown pickers instead of free-text ID entry. `/client/seo`
  is no longer permanently empty — keywords compute live from real
  `tracked_keywords` data, other metrics are a real admin-editable section.
  See `AUDIT.md` #666-#689 for the full list.
- Full-app audit sweep (8 agents, widest scope yet) at the user's request to
  audit the whole app and assess how much is left. Only 10 new findings
  (#691-700) surfaced — this app has been through 8+ full/coverage-gap
  sweeps and is genuinely mature. 7 fixed directly, including a real
  regression in this session's own #675 `ClientIntegrationsPanel` rewrite
  (dead recovery button, caught by the adversarial-review lane) and a
  missing `fireAutomations('contract_executed', ...)` call on the real
  e-signature completion path. One agent's finding (a push-notification
  claim referencing #152) didn't hold up under investigation — traced
  `AppShell.tsx`'s actual render branches and confirmed portal clients never
  reach `PushNotificationBanner` regardless, so `#152`'s stale claim was
  corrected in place instead of "fixing" a non-existent bug. 2 left open as
  genuine feature-completion/product-decision work, not bugs: #693 (client
  Delivery Timeline's per-step detail panel needs real data threaded from
  several tables) and #699 (calendar-sync pushes public bookings to an
  arbitrary staff calendar — `booking_types` has no owner concept in the
  schema at all). See `AUDIT.md` #691-#700 for the full list.
- Fixed a live-only schema-drift bug (#701) the user hit directly: every
  `POST /api/deals` 500'd because `deals.service_types` was never actually
  added to the live DB (unlike the equivalent `projects.service_types`
  migration, confirmed applied 2026-08-01) — the code was already correct.
  User ran the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + backfill in the
  Supabase SQL Editor and confirmed success. Also merged `SEO / AEO` and
  `GEO` into one catalog entry (#702, `lib/services.ts`) per user feedback
  that they shouldn't be two separately-pickable services.
- Built both items flagged above, per the user's "Work on it" go-ahead:
  - **Deal line items** (`lib/types.ts`'s `DealLineItem`, `lib/deal-line-items.ts`,
    `components/crm/DealLineItemsEditor.tsx`): a deal can now be pitched as
    multiple products/services at different rates and billing types
    (`"$25.5K one-time + $57K recurring"` instead of one opaque `value`).
    `amount` on a line item is that line's full contribution to the deal's
    total pitched value (not a monthly rate, even for recurring lines) —
    deliberately the opposite convention from `lib/metrics.ts`'s signed
    *contract* `value` (per-billing-period, since a contract bills
    indefinitely) — matched to the user's own stated arithmetic. Both
    `POST /api/deals` and `PATCH /api/deals/[id]` derive `value`/
    `serviceTypes` from `lineItems` when present via shared helpers; old
    deals with no line items keep working unchanged. Requires the
    `deals.line_items jsonb` column — see "Pending user action" below,
    same live-DB-drift risk as the `service_types` fix.
  - **Company-page quick-action buttons**: `app/crm/companies/page.tsx`'s
    `CompanyPanel` gained "New Deal" (Deals tab) and "New Contract"
    (Contracts tab) buttons, mirroring the existing self-contained "New
    Proposal" button already there (fire-and-forget POST, company
    pre-filled, no shared list state to update). New Deal navigates to
    `/crm/pipeline?open=<id>` on success; New Contract to
    `/contracts?open=<id>`. Correction to an earlier note in this file:
    proposals could *already* be created from the company page before this
    session — only deals and contracts were actually missing that entry
    point.

- **Cross-module integration pass** (the organizing theme of this session,
  after the user's "all of the features and services need to be connected to
  each other"). The finding underneath it: this app's individual modules are
  unusually mature, but they barely talked to each other. Built:
  - `lib/activity-log.ts` — makes `crm_activities` genuinely unified.
    Finance, Delivery/Ops, and Support never wrote to it at all, so a
    company's "Activity" tab was an email-and-proposal log wearing a
    unified-timeline label.
  - `lib/delivery-sync.ts` (AUDIT #723) — the 8-step Delivery Workflow now
    advances from real events (contract fully executed → step 1, invoice
    paid → step 2, portal login → step 4), wired at BOTH entry points for
    each event. Forward-only, idempotent, never throws. Was previously
    written by exactly one place, so it was a checklist someone had to
    remember to tick.
  - `lib/automations-engine.ts` — new `Create Invoice` action (no
    invoice-creation action existed at all), new triggers for Delivery/Ops
    and Support (which had none), and `company_id` added to 6 legacy actions.
  - `lib/recurring-billing.ts`, `lib/company-match.ts`, `lib/deal-reporting.ts`,
    `lib/renewal-pricing.ts`, `lib/serp-provider.ts` + competitor rank
    snapshots, self-enrollment for courses, and the Company Panel's four new
    tabs (Proposals / Invoices / Projects / Tickets).
- **Durable account lockout** (AUDIT #722) — `lib/login-attempts.ts`'s
  counters moved from an in-process Map to Postgres. On Vercel the Map was
  effectively free to reset by hitting a different instance. Postgres, not
  Redis/Upstash, on purpose: Supabase is already here.
- **Judgment calls made without asking**, per the user's "go with your
  recommendations": corrected the OAuth-expiry doc rather than extending the
  180-day policy to Calendar (forcing expiry would silently break an
  unattended cron sync); skipped unassigned booking types rather than
  falling back to a random calendar; refused to invent a renewal term-length
  divisor and made the UI honest instead (AUDIT #707).

## Where to look first

- `AUDIT.md` — the real bug/finding tracker, maintained by `/audit` runs.
  Check it before re-investigating something that might already be logged.
- `supabase/schema.sql` — canonical schema, but verify against the live DB
  before trusting it fully (see schema-drift note above).
- `CLAUDE.md` — session/tooling instructions (skills, gstack conventions).
