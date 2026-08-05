-- Project budget / hours-estimate tracking.
--
-- `projects` had no commercial dimension at all: no budget, no hours
-- estimate. Time tracking already captures the real hours per project
-- (`time_entries.project_id`), so the actual side of "are we over budget on
-- this engagement?" existed while the planned side did not, leaving the
-- question unanswerable anywhere in the app.
--
-- Both columns are NULLABLE WITH NO DEFAULT, deliberately. NULL means "not
-- tracked for this project" and must never be coerced to 0 — a default of 0
-- would make every one of the existing projects instantly read as "0 hours
-- budgeted, 100% over estimate" on the project detail page. The UI only
-- renders the budget section when at least one of these is non-null, so a
-- project with neither looks exactly as it does today.
--
-- Deliberately NOT included: any per-project or per-person billing rate.
-- There is no rate anywhere in this schema (no hourly_rate on team_members,
-- time_entries, contracts or projects; invoices have no project_id either),
-- so money-spent-to-date cannot be computed honestly and this migration does
-- not pretend otherwise by inventing a rate column nothing would populate.
-- `budget_amount` is stored and displayed as the agreed figure only; adding
-- real spend-vs-budget needs a rate source first (see the comment in
-- app/projects/[id]/page.tsx).

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget_amount numeric;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS estimated_hours numeric;

COMMIT;
