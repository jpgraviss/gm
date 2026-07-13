-- AUDIT.md #12/#13, Increment 1 — Wait/Delay correctness.
--
-- The Wait action never actually paused anything: it inserted into
-- automation_pending_steps using context keys nothing ever set
-- (_automationId/_runId/_remainingActions), so every insert wrote an
-- empty-string automation_id, which violates this table's own
-- NOT NULL REFERENCES automations(id) constraint — the insert silently
-- failed, and the surrounding loop fell through to the next action in
-- the same pass instead of actually waiting.
--
-- Correction: an earlier version of this migration also tried to extend
-- automation_pending_steps' status CHECK constraint, based on a migration
-- file in this repo (add_automation_runs.sql) that doesn't reflect the
-- table's real, live shape — the live table has no status column at all
-- (confirmed via information_schema.columns). Resume position there is
-- tracked via step_index instead; app code (lib/automations-engine.ts,
-- app/api/cron/route.ts) was corrected to match the real schema, and a
-- claimed pending step is deleted rather than status-updated, so no
-- schema change is needed for that table.
--
-- automation_runs DOES have a real status column (confirmed the same
-- way), and had no way to represent "paused at a Wait step, not yet
-- complete" — its CHECK constraint only allowed 'running' | 'completed' |
-- 'failed', so a paused run would have been mislabeled 'completed' after
-- only partially executing its actions.
alter table public.automation_runs drop constraint if exists automation_runs_status_check;
alter table public.automation_runs add constraint automation_runs_status_check
  check (status in ('running', 'completed', 'failed', 'waiting'));
