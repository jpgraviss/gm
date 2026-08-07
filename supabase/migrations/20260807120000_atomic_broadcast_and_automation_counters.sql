-- AUDIT #769 — two read-then-write counter increments survived the four
-- earlier passes that converted this class to atomic RPCs (#247, #276, the
-- KB/funnel pass, and the form-submissions pass).
--
-- The serious one is broadcast delivery stats. Resend posts a webhook per
-- recipient per event, so a 5,000-recipient broadcast produces thousands of
-- concurrent POSTs to /api/sequences/webhooks, each doing
--   SELECT total_opened -> total_opened + 1 -> UPDATE
-- on the *same* broadcasts row. Lost updates aren't an edge case at that
-- concurrency, they're the steady state: reported opens/clicks/deliveries
-- are systematically lower than reality, and always in the direction that
-- makes a campaign look worse than it performed.
--
-- `increment_broadcast_clicked` already existed for exactly this table but
-- only covers total_clicked, and only the click-tracking route used it. The
-- webhook route touches five columns, so this generalises it the same way
-- `increment_kb_article_feedback` generalises over its two columns: a text
-- column name validated against a whitelist before it reaches format(%I).

create or replace function increment_broadcast_counter(
  p_id     text,
  p_column text
) returns void as $$
begin
  if p_column not in (
    'total_delivered', 'total_opened', 'total_clicked',
    'total_bounced', 'total_unsubscribed'
  ) then
    raise exception 'invalid column %', p_column;
  end if;
  execute format(
    'update broadcasts set %I = coalesce(%I, 0) + 1 where id = $1',
    p_column, p_column
  ) using p_id;
end;
$$ language plpgsql;

-- automations.runs had the same shape. Lower stakes — it drives a displayed
-- "runs" count and last_run timestamp rather than campaign reporting — but
-- it races for a real reason: a bulk CSV import that creates 200 contacts
-- fires 200 `contact_created` triggers against the same automation row at
-- once, so the visible run count drifts below the number of runs that
-- actually happened.
create or replace function increment_automation_runs(
  p_id text
) returns void as $$
  update automations
  set runs = coalesce(runs, 0) + 1,
      last_run = now()
  where id = p_id;
$$ language sql;

-- NOTE: this migration has NOT been run against the live database — apply
-- manually. Both call sites fall back to the previous read-then-write if
-- the function is missing, so deploying the code before running this is
-- safe: it is no worse than today's behaviour, just not yet fixed.
