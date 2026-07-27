-- AUDIT.md #247 — the newer email-tracking-extension endpoints
-- (track/click/[token], track/click/ext/[token], track/open/[id]) all
-- incremented via a plain read-then-write `(x ?? 0) + 1` instead of an
-- atomic RPC, unlike this codebase's established pattern
-- (adjust_sequence_counts, increment_review_campaign_counts). Concurrent
-- opens/clicks on the same tracked email could undercount by one.

create or replace function increment_tracked_email_counts(
  p_id     text,
  p_opens  integer default 0,
  p_clicks integer default 0
) returns void as $$
  update tracked_emails
  set open_count      = open_count + p_opens,
      last_opened_at  = case when p_opens > 0 then now() else last_opened_at end,
      click_count     = click_count + p_clicks,
      last_clicked_at = case when p_clicks > 0 then now() else last_clicked_at end
  where id = p_id;
$$ language sql;

create or replace function increment_broadcast_clicked(
  p_broadcast_id text
) returns void as $$
  update broadcasts
  set total_clicked = total_clicked + 1
  where id = p_broadcast_id;
$$ language sql;
