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
-- The app-code fix (lib/automations-engine.ts) now writes a real
-- automation_id/run_id and genuinely stops executing when it hits a
-- Wait. But the resume side (app/api/cron/route.ts) writes 'completed'/
-- 'failed' on completion, and this table's CHECK constraint only ever
-- allowed 'pending' | 'resumed' | 'cancelled' — so the moment the write
-- side started producing valid rows, every resumed step would violate
-- this constraint, fall into a catch block that ALSO writes an illegal
-- status, throw, and leave the row stuck at 'pending' — meaning it gets
-- picked up and re-executed on every subsequent cron tick, forever.
-- This must ship in the same deploy as the write-side fix.
alter table public.automation_pending_steps drop constraint if exists automation_pending_steps_status_check;
alter table public.automation_pending_steps add constraint automation_pending_steps_status_check
  check (status in ('pending', 'resumed', 'cancelled', 'failed'));

-- automation_runs also had no way to represent "paused at a Wait step,
-- not yet complete" — its CHECK constraint only allowed 'running' |
-- 'completed' | 'failed', so a paused run would have been mislabeled
-- 'completed' after only partially executing its actions.
alter table public.automation_runs drop constraint if exists automation_runs_status_check;
alter table public.automation_runs add constraint automation_runs_status_check
  check (status in ('running', 'completed', 'failed', 'waiting'));
