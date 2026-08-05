# supabase/migrations/

SQL that has been (or is about to be) applied to the live GravHub Supabase
project. This is a **historical record plus a delivery queue**, not a tool-managed
migration state machine — read the workflow section below before adding anything.

---

## Naming convention (required for every new file)

```
YYYYMMDDHHMMSS_short_description.sql
```

- `YYYYMMDDHHMMSS` — UTC timestamp of when the migration was written.
- `short_description` — lowercase, `_`-separated.

Examples:

```
20260805143000_add_invoice_dunning_fields.sql
20260806090000_backfill_company_id_on_app_tasks.sql
```

Get the prefix with:

```bash
date -u +%Y%m%d%H%M%S
```

### Why

Filenames are the only ordering signal this directory has. There is no
`schema_migrations` table, no `supabase db push`, and no applied-at bookkeeping —
so with names like `add_audits.sql` / `fix_proposal_pdfs_storage_rls.sql` there is
no way to tell from the repo which of two files that touch the same table was
meant to run first. Several files here *only* make sense after another file ran
(e.g. a `fix_*` that repairs a policy created by an earlier `add_*`). A sortable
timestamp prefix makes `ls` the apply order.

This is enforced in CI — see "Enforcement" below.

### The 144 existing exceptions

Every file in this directory except `20250706120000_import_hubspot_latest.sql`
predates the convention. **Do not rename them.** They have already been applied to
production; renaming would rewrite the historical record, break every reference to
them in `AUDIT.md` / `project_memory.md` / commit messages, and gain nothing —
their apply order is already settled, because it already happened.

They are grandfathered in by an explicit checked-in list:
`scripts/legacy-migration-filenames.txt`. The convention applies to everything
added from now on.

---

## Workflow: how a migration actually reaches the database

**Writing the file here does not apply it.** This repo's established convention
(see `project_memory.md`) is:

1. Write the migration file in this directory with a timestamp-prefixed name.
2. **Paste the SQL directly into the chat message** for the user to run in the
   Supabase SQL Editor — not just as a file attachment, and not only as a path.
3. The user runs it and reports back "Success" or pastes the error.
4. Only after that confirmation is the column/table safe to read or write from
   application code.

Development sessions have no live Supabase credentials, so there is no path that
applies these automatically. Storage-level changes (moving/copying objects in a
bucket) can't be done in SQL at all — those get handed off as a standalone Node
script under `scripts/` that the user runs locally with their own
`SUPABASE_SERVICE_ROLE_KEY`.

### SQL style requirements

Carried over from `project_memory.md`, because every one of these files is run by
hand against production:

- **Idempotent** — `create table if not exists`, `add column if not exists`,
  `on conflict do nothing`, `where not exists`. Re-running a file must be a no-op.
- **Transactional** — wrapped in `BEGIN;` / `COMMIT;`.
- **Header comment** stating the scope and what is *deliberately* excluded and why.

### Schema drift is real — check before you trust

A file existing in this directory does **not** mean it has been applied.
`add_deals_service_types.sql` sat here unapplied long enough that every
`POST /api/deals` 500'd in production while the code was already correct
(`AUDIT.md` #701). `supabase/schema.sql` is likewise a partial snapshot: it
declares ~28 tables, while this directory creates ~98. Neither file is
authoritative about the live database.

Before writing new SQL for a "column does not exist" error, grep this directory —
more than once the exact fix was already sitting here, written but never run.

---

## Enforcement

`.github/workflows/ci.yml` runs:

```bash
node scripts/check-migration-naming.mjs
```

It fails the build when a `.sql` file appears in this directory that is neither
timestamp-prefixed nor on the legacy list. Run it locally before pushing.

Non-`.sql` files (this README) are ignored. If a historical migration is
intentionally renamed or deleted, update `scripts/legacy-migration-filenames.txt`
in the same commit — the check flags list entries that no longer exist on disk so
the exemption list can't silently rot.
