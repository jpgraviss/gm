-- AUDIT.md #16 follow-up — checkTimeBasedTriggers() (app/api/cron/route.ts)
-- fires invoice_overdue (3+ days overdue) and renewal_90/renewal_30 for
-- EVERY matching row on EVERY cron tick, with no dedup. This was survivable
-- (if wasteful) at once-daily cadence; now that #16 moved /api/cron to a
-- 5-minute GitHub Actions schedule, an invoice that's been overdue 3+ days
-- (or a contract sitting inside its renewal window) fires the same
-- automation up to 288x/day for the entire duration, instead of once.
--
-- The initial Sent->Overdue transition is already self-throttling (the
-- status update takes it out of that query on the next tick) and is
-- untouched here — only the two genuinely-unbounded cases get a flag.
alter table public.invoices
  add column if not exists overdue_3d_notified boolean not null default false;

alter table public.contracts
  add column if not exists renewal_90_notified boolean not null default false,
  add column if not exists renewal_30_notified boolean not null default false;
