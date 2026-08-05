# GravHub — Disaster Recovery

**Status: PARTIALLY UNVERIFIED. Read [Section 2](#2-action-required-verify-pitr-is-actually-on) first.**

GravHub holds the contracts, invoices, payment records, client contact data, and
signed-document trail for ~30 real Graviss Marketing clients. As of this
document being written, the only thing resembling a backup was the Admin Panel's
"System Backup" button — a partial JSON download with **no restore path at all**
(see [Section 5](#5-what-the-admin-panel-system-backup-button-actually-does)).

This document is a runbook, not a status report. It cannot tell you whether
Point-in-Time Recovery is enabled, because that lives in the Supabase dashboard
and nothing in this repository can see it. Section 2 is the action you have to
take yourself.

---

## 1. What data lives where

### 1a. Postgres (Supabase) — the primary system of record

Everything the app reads and writes lives in the `public` schema of one Supabase
Postgres project. As of this writing the repository's SQL declares **98 tables**
across `supabase/schema.sql` + `supabase/migrations/*.sql`.

> `supabase/schema.sql` is **not** a complete schema. It declares ~28 tables;
> the migrations directory creates ~98. Neither is authoritative about the live
> database — migrations have shipped in this repo that were never applied
> (`AUDIT.md` #701). Treat the live database as the only source of truth.
> `scripts/backup-database.mjs` reconciles all three and reports the drift.

The highest-consequence tables, roughly in order of how bad losing them would be:

| Domain | Tables |
| --- | --- |
| **Money** | `invoices`, `contracts`, `contract_addendums`, `renewals`, `deals`, `proposals`, `revenue_months`, `time_entries` |
| **Client identity** | `crm_companies`, `crm_contacts`, `crm_activities`, `contact_timeline`, `portal_clients`, `company_files` (metadata) |
| **Signed documents** | `signature_requests`, `document_templates`, `proposals` |
| **Delivery / ops** | `projects`, `app_tasks`, `tickets`, `maintenance_records`, `delivery_workflows`, `delivery_events`, `report_work_log` |
| **Marketing state** | `sequences`, `sequence_enrollments`, `broadcasts`, `broadcast_recipients`, `scheduled_emails`, `review_campaigns`, `social_posts` |
| **Config / credentials** | `app_settings`, `client_integrations`, `google_integrations`, `meta_integration`, `social_connections`, `wordpress_seo_settings` (several hold encrypted third-party tokens) |
| **Audit trail** | `audit_logs`, `audits`, `automation_runs`, `ai_usage_log` |

Also in Postgres but **outside** the `public` schema, and therefore **not**
reachable by any export this repo can run:

- **`auth` schema** — Supabase Auth users, identities, sessions, refresh tokens.
  Every staff login and every portal client login lives here. A `public` -only
  restore leaves you with client records that nobody can log in to see.
- **`storage` schema** — bucket definitions and object metadata.

### 1b. Supabase Storage — file bytes

Three buckets, all private:

| Bucket | Created by | Contents | Referenced from |
| --- | --- | --- | --- |
| `client-files` | `supabase/migrations/add_storage_and_time_entry_fields.sql` | Client portal file uploads, foldered by `crm_companies.id` (legacy files still under a sanitized-name folder — see `lib/file-storage.ts`) | `app/api/files/*`, `lib/file-storage.ts` (`CLIENT_FILES_BUCKET`) |
| `proposal-pdfs` | `supabase/migrations/add_proposal_generation.sql` | Generated proposal PDFs, keyed by `proposals.pdf_path` | `app/api/proposals/generate`, `app/api/proposals/[id]/pdf`, `app/api/proposals/view/[token]` |
| `company-files` | **No migration creates this bucket.** It is referenced in code only. | CRM company file attachments; rows in `company_files` hold `storage_path` | `app/api/crm/companies/[id]/files/route.ts` |

> **Open item:** `company-files` is used by `app/api/crm/companies/[id]/files/route.ts`
> but no file in `supabase/migrations/` ever runs
> `insert into storage.buckets ... 'company-files'`. Either it was created by
> hand in the dashboard (in which case it exists live but is undocumented and
> would not be recreated by replaying the migrations) or it does not exist and
> that feature is broken. Confirm in **Dashboard → Storage** and, if it exists,
> add a migration that creates it idempotently.

Storage objects are **not** covered by Postgres PITR. They have their own
retention behaviour — confirm it (Section 2, step 4).

### 1c. Outside Supabase entirely

| Thing | Where | Recovery |
| --- | --- | --- |
| Application code | This git repository | git |
| Environment variables / secrets | Vercel project settings (19 documented in `.env.local.example`) | **Not backed up anywhere.** See Section 4c. |
| Cron trigger | `vercel.json` (daily) + `.github/workflows/cron-ping.yml` (every 5 min); needs GitHub Actions secrets `CRON_TARGET_URL` and `CRON_SECRET` | Re-create the secrets |
| Payment records | Stripe (independent system of record for money actually moved) | Stripe dashboard |
| Sent email | Resend | Resend dashboard |
| Error history | Sentry | Sentry |

---

## 2. ACTION REQUIRED: verify PITR is actually on

**This cannot be checked from the codebase, from CI, or from any agent session.
It requires someone signed in to the Supabase dashboard for the production
project. Until someone does this and writes the result into Section 2e below,
GravHub has no confirmed recovery capability.**

### 2a. Check the plan tier

1. Go to <https://supabase.com/dashboard>.
2. Select the **production** GravHub project (confirm it matches the project ref
   in `NEXT_PUBLIC_SUPABASE_URL` in Vercel → Settings → Environment Variables —
   the ref is the `xxxxxxxx` in `https://xxxxxxxx.supabase.co`).
3. **Project Settings → Billing** (or the org's Billing page). Note the plan.

What each tier gives you:

- **Free** — **no backups of any kind.** No daily backups, no PITR. If the
  production project is on Free, everything below is moot and this is the single
  most urgent item on the list.
- **Pro** — daily backups with 7-day retention, taken once per day. PITR is
  **not** included; it is a paid per-project add-on.
- **Team / Enterprise** — longer daily retention; PITR still an add-on.

**PITR requires Pro plan or above, and is a separately purchased add-on.**
Retention is sold in tiers (7 / 14 / 28 days at time of writing). Exact tiers
and pricing change — read the current numbers off the dashboard rather than
trusting this sentence.

### 2b. Check whether PITR is enabled and what the window is

1. In the project, go to **Database → Backups**.
2. There are two tabs: **Scheduled backups** and **Point in Time**.
   - **Scheduled backups** lists the daily logical backups and their retention.
     Record the oldest date shown.
   - **Point in Time** either shows a purchase/upgrade prompt (**PITR is OFF**)
     or a timeline with an earliest-restorable timestamp (**PITR is ON**).
3. If PITR is ON, the earliest restorable point shown on that tab **is** your
   real recovery window. Write down the actual number of days, not the number
   you bought — WAL archiving needs time to build up after enabling.
4. To turn it on: **Project Settings → Add-ons → Point in Time Recovery**, pick a
   retention tier, confirm. It starts accumulating from the moment it is enabled;
   it is not retroactive.

### 2c. Understand what a PITR restore actually does

Before an incident, not during one:

- A dashboard PITR restore is **in-place**: it rewinds the existing project to
  the chosen timestamp. Everything written after that timestamp is gone.
  There is no merge and no undo.
- The project is **unavailable during the restore**. The app will be down.
- Restore granularity and whether restoring to a *separate* project is possible
  from the dashboard has changed over time — **check the current behaviour on
  the Point in Time tab and note it in 2e**, rather than discovering it mid-outage.
- Restore covers Postgres. It does **not** roll back Storage objects, and it does
  not roll back anything in Stripe, Resend, or Google/Meta.

### 2d. Also verify

- **Storage retention** — Dashboard → Storage. Confirm whether the buckets are
  covered by the project's backups at all, and whether object versioning exists.
  Assume they are **not** covered until proven otherwise.
- **`company-files` bucket exists** (see the open item in Section 1b).
- **Someone other than one person has dashboard access.** A recovery plan that
  depends on a single account with a single MFA device is not a recovery plan.
- **The GitHub Actions secrets `CRON_TARGET_URL` / `CRON_SECRET` are recorded
  somewhere retrievable** (Settings → Secrets and variables → Actions shows
  names but never values).

### 2e. Record the answers here

Fill this in. An empty table means "unverified", not "fine".

```
Date checked:            ____________________
Checked by:              ____________________
Supabase project ref:    ____________________
Plan tier:               ____________________
Daily backups retention: ______ days (oldest shown: __________)
PITR enabled:            YES / NO
PITR earliest restore:   ____________________  (=> ______ days of real window)
Restore is in-place?     YES / NO / (note actual dashboard behaviour)
Storage buckets backed up? YES / NO / UNKNOWN
`company-files` bucket exists? YES / NO
Dashboard access held by: ____________________
Last local dump taken:   ____________________
```

---

## 3. The local dump: `scripts/backup-database.mjs`

A supplement to PITR that you control and can read without Supabase being alive.

```bash
# with .env.local present in the working copy:
node scripts/backup-database.mjs

# or explicitly:
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/backup-database.mjs
```

Writes `backups/gravhub-backup-<UTC timestamp>.json` (gitignored — the file
contains every client's contract and invoice data, do not commit it).

**How it avoids being a fake backup:**

- **The table list is discovered, not hardcoded.** It parses every
  `create table` in `supabase/schema.sql` + `supabase/migrations/*.sql`, then
  asks the live database what it *actually* exposes via PostgREST's OpenAPI
  description, and dumps the live list. Drift in both directions is reported in
  the output manifest.
- **It pages properly.** Every table is read in 1,000-row `.range()` pages
  ordered by primary key, then the total is checked against a separate
  `count: 'exact'` query. Any mismatch is a hard failure. This is `AUDIT.md`
  #209 territory — the "full backup" button silently stopped at 100 rows per
  entity, and this repo has hit that same truncation bug 15+ times.
- **It never writes a partial file that looks complete.** Data is assembled in
  memory, written to a `.tmp`, then atomically renamed. If any table fails, or if
  live introspection fails, the file is named `...INCOMPLETE.json`,
  `manifest.complete` is `false`, and the exit code is 1.

**What it does NOT cover** (also stated in every output file's
`manifest.notCovered`):

- Supabase Storage object bytes.
- The `auth` schema — no users, no logins.
- RLS policies, functions, triggers, indexes, enums, sequence positions,
  extensions.

So a restore from this file alone gives you *data* but not a *working system*.
It is a hedge against "Supabase account gone / project deleted / bad actor",
and it is the artifact you diff against when you need to know exactly which rows
an accident destroyed. It is not a replacement for PITR.

### Backing up Storage as well

The script deliberately does not download file bytes. Use the Supabase CLI:

```bash
# one folder per bucket, run from wherever you keep backups
npx supabase login
npx supabase storage cp -r "ss:///client-files"   ./storage-backup/client-files   --experimental
npx supabase storage cp -r "ss:///proposal-pdfs"  ./storage-backup/proposal-pdfs  --experimental
npx supabase storage cp -r "ss:///company-files"  ./storage-backup/company-files  --experimental
```

Verify the CLI's current storage subcommand syntax with `npx supabase storage --help`
before relying on this — it has been an experimental command and the flags have
moved. Confirm the object counts against **Dashboard → Storage** afterwards.

### Suggested cadence

Until PITR is confirmed on: **weekly**, and immediately before any bulk
data operation (an import script, a mass update, a migration that touches
existing rows).

After PITR is confirmed on: monthly, plus before bulk operations. PITR is the
primary mechanism; this is the off-platform hedge.

---

## 4. Restore runbooks

### 4a. Accidental bulk delete / bad UPDATE on one table's rows

*Example: a `delete from invoices where ...` with a wrong predicate, or an
import script that overwrites 200 `crm_companies` rows.*

**Stop first.**

1. **Stop writes to the affected table immediately.** The recovery window is
   bounded by how long the damage sits there being written over.
   - Pause the cron loop: disable the **Cron Ping** workflow in
     GitHub → Actions → Cron Ping → `⋯` → *Disable workflow*. It fires every 5
     minutes and 12+ jobs write to the database on each tick
     (`app/api/cron/route.ts`).
   - Tell anyone using the app to stop.
2. **Write down the time the damage happened**, as precisely as you can, in UTC.
   PITR restores to a timestamp; a wrong guess costs you real data.
3. **Quantify it** before touching anything:
   ```sql
   select count(*) from public.invoices;
   select max(created_at), min(created_at) from public.invoices;
   ```
   Compare against the most recent `backups/gravhub-backup-*.json`
   (`manifest.tables.<table>.rows`).

**Then pick a path, cheapest first:**

**Path A — restore just those rows from a local dump (preferred; no downtime).**
Only viable if a dump exists from before the damage and the lost rows haven't
been recreated since.

1. Extract the table from the dump:
   ```bash
   node -e "const b=require('./backups/gravhub-backup-<stamp>.json'); \
     console.log(JSON.stringify(b.data.invoices,null,2))" > /tmp/invoices.json
   ```
2. Confirm the dump is trustworthy: `manifest.complete` must be `true`, and
   `manifest.tables.invoices.rows` must equal
   `manifest.tables.invoices.reportedCount`.
3. Re-insert with conflict handling so you never clobber rows that survived.
   Per this repo's convention, hand the SQL to the person with dashboard access
   to run in the **Supabase SQL Editor**, wrapped in `BEGIN;`/`COMMIT;` and
   idempotent:
   ```sql
   BEGIN;
   -- Restores rows deleted at <UTC time> from backup <filename>.
   -- ON CONFLICT DO NOTHING: rows recreated since the incident win.
   insert into public.invoices (id, company, amount, status, due_date, ...)
   values (...)
   on conflict (id) do nothing;
   COMMIT;
   ```
   For anything more than a handful of rows, generate that SQL from the JSON with
   a throwaway script rather than by hand, and **have someone read the generated
   SQL before it runs.**
4. Re-check the counts from step 3, then re-enable the Cron Ping workflow.

**Path B — PITR (only if a dump won't do it).**
A PITR restore is **whole-project and in-place**: it rewinds *every* table, not
just the damaged one, and discards everything written after the target
timestamp. For a single-table accident this usually trades one data-loss
incident for a larger one.

Do this only when the damage is large, spans many tables, or there is no usable
dump — and if you do:

1. Take a local dump **first** (`node scripts/backup-database.mjs`), so you keep
   a copy of the post-incident state. Rows created after the target timestamp
   exist only in that file once the restore completes.
2. **Database → Backups → Point in Time**, choose a timestamp a minute or two
   *before* the damage, confirm.
3. The project goes down for the duration.
4. After it returns: verify counts, then hand-re-apply anything legitimate that
   happened between the target timestamp and the incident, using the dump from
   step 1.
5. Re-enable the Cron Ping workflow.

**Path C — no PITR, no dump.** Open a Supabase support ticket immediately and
ask what daily backup exists for the project. On Pro, the most recent daily
backup is the ceiling: you lose up to 24 hours. On Free, there is nothing to
recover. This path is the reason Section 2 exists.

### 4b. Full project loss

*Supabase project deleted, account compromised or locked out, region-level loss.*

Order matters — data is useless until identity works.

1. **Confirm it's actually gone**, not a transient outage:
   <https://status.supabase.com>, then the dashboard.
2. **If the account is compromised:** rotate `SUPABASE_SERVICE_ROLE_KEY` first
   (it bypasses RLS entirely and every API route uses it), then every third-party
   credential in `.env.local.example` — Stripe, Resend, Google, Meta, OpenAI/
   Anthropic, `CRON_SECRET`, `ENCRYPTION_KEY`.
   > **`ENCRYPTION_KEY` is special: if you lose it, you cannot rotate it.**
   > Stored OAuth tokens and WordPress credentials (`client_integrations`,
   > `google_integrations`, `wordpress_seo_settings`, Gmail tokens) are
   > encrypted with it. Losing the key means every one of those integrations
   > must be reconnected by hand. Losing the key *and* the database means the
   > ciphertext is unrecoverable.
3. **Create a new Supabase project.** Record the new project ref and URL.
4. **Rebuild the schema.** There is no automated path — this repo has no
   `schema_migrations` table and no `supabase db push` workflow. In order:
   1. `supabase/schema.sql` (the base ~28 tables).
   2. Every file in `supabase/migrations/*.sql` in apply order. This is the
      painful part: 144 of 145 files have no timestamp prefix and therefore no
      enforced order (see `supabase/migrations/README.md`). Files are idempotent
      by convention, so re-running is safe — expect to iterate on
      dependency-order errors. Budget hours, not minutes.
   3. Storage buckets: `client-files` and `proposal-pdfs` are created by their
      migrations. **`company-files` is not** — create it by hand
      (private, not public) if the app needs it.
   4. RLS policies come from the migrations; verify a few by hand afterward,
      particularly the `proposal-pdfs` policies (a broad `authenticated` policy
      there is a cross-tenant leak — see the header comment in
      `add_proposal_generation.sql` and `fix_proposal_pdfs_storage_rls.sql`).
5. **Restore data** from the most recent `manifest.complete === true` dump.
   Load parents before children — `crm_companies` and `team_members` before
   `deals`/`projects`/`invoices`/`app_tasks` — or foreign keys will reject the
   insert. Verify each table's row count against `manifest.tables`.
6. **Recreate auth users.** The dump does **not** contain the `auth` schema.
   Staff and portal clients must be re-invited / re-provisioned. Rows in
   `portal_clients` and `team_members` will be restored, but the login identities
   behind them will not.
7. **Restore Storage objects** from your `storage-backup/` copy (Section 3), or
   accept that generated proposal PDFs are regenerable and client uploads are not.
8. **Update Vercel** → Settings → Environment Variables:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. Redeploy.
9. **Update GitHub Actions secrets** if `CRON_SECRET` changed
   (Settings → Secrets and variables → Actions: `CRON_SECRET`, `CRON_TARGET_URL`).
10. **Smoke test before telling anyone it's back:** log in as staff; log in as one
    portal client; open a company page and confirm deals/contracts/invoices load;
    open an invoice; upload and re-download one file; manually trigger the cron
    endpoint and check that every job in the response reports success rather than
    `{"error":"Failed"}` (see `tests/integration/cron-route.test.ts` for the
    response shape).

### 4c. Losing Vercel environment variables

Less dramatic, equally paralysing. The 19 variables in `.env.local.example` exist
in exactly two places: Vercel's project settings, and whatever local `.env.local`
files people happen to have. There is no backup.

- Keep a current copy in a password manager, not in the repo.
- `ENCRYPTION_KEY` in particular is unrecoverable and un-rotatable (see 4b step 2).

---

## 5. What the Admin Panel "System Backup" button actually does

`app/admin/page.tsx` → **System Backup** → **Download Backup**.

It fetches seven application API endpoints in the browser and saves the combined
result as `gravhub-backup-<epoch>.json`:

| Included | Source endpoint |
| --- | --- |
| `users` | `/api/team-members?include_inactive=true` |
| `contacts` | `/api/crm/contacts` |
| `proposals` | `/api/proposals` |
| `contracts` | `/api/contracts` |
| `invoices` | `/api/invoices` |
| `projects` | `/api/projects` |
| `deals` | `/api/deals` |

Six of the seven correctly follow cursor pagination via `fetchAllPages()` (fixed
in `AUDIT.md` #209 — before that fix, any entity with more than 100 rows was
silently truncated); `team-members` isn't cursor-paginated and is a plain fetch.

**What it does not cover — 91 of the 98 tables**, including:

- `app_tasks`, `tickets`, `time_entries`, `renewals`, `maintenance_records`
- `crm_companies` and `crm_activities` (contacts are exported; the companies
  they belong to are not)
- `revenue_months`, `contract_addendums`, `signature_requests`
- every marketing table (`sequences`, `broadcasts`, `scheduled_emails`,
  `review_campaigns`, `social_posts`, …)
- every settings/credential table (`app_settings`, `client_integrations`, …)
- `audit_logs` and the whole audit trail
- Storage objects and the `auth` schema

It also exports **API-shaped** JSON — the routes' response field names, not the
database column names — so it cannot be re-inserted into Postgres without
per-entity remapping. There is no restore path in the app or in this repo, and
the modal's claim of "a full JSON snapshot of all GravHub data" is not accurate.

**Treat it as a convenience export for spreadsheets. It is not a disaster
recovery mechanism.** Use `scripts/backup-database.mjs` (Section 3) for anything
you might actually need to restore from, and PITR (Section 2) as the primary
recovery mechanism.

---

## 6. Known gaps in this plan

Stated plainly so nobody mistakes this document for an all-clear:

1. **PITR status is unverified.** Section 2 is unanswered until someone with
   dashboard access fills in 2e. Everything in Section 4 that depends on PITR is
   contingent on that.
2. **No restore has ever been tested.** An untested restore is a hypothesis. The
   only way to fix this: after Section 2 is answered, do a dry run — take a
   dump, stand up a scratch Supabase project, and walk Section 4b end to end.
   Time it. Whatever number you get is the real RTO.
3. **No RPO/RTO agreed.** How much data may Graviss lose (an hour? a day?) and
   how long may GravHub be down? Those two numbers determine whether Pro + 7-day
   PITR is adequate or whether the retention tier needs raising. Nobody has set
   them.
4. **Backups are manual.** `scripts/backup-database.mjs` runs when a human
   remembers. It could be scheduled (a GitHub Actions workflow with the service
   key as a repo secret, uploading to object storage) — that is deliberately not
   built here, because putting a service-role key and full client financial data
   into a CI artifact is a security decision, not an implementation detail.
5. **The `auth` schema has no export path at all.** Even a perfect `public`
   restore leaves everyone locked out until users are re-provisioned.
6. **`company-files` bucket provenance is unknown** (Section 1b).
7. **Schema rebuild is manual and unordered** — 144 migrations with no enforced
   apply order (Section 4b step 4).
