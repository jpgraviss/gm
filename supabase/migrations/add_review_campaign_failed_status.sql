-- AUDIT — POST /api/reputation/requests previously marked every
-- just-dispatched campaign 'sent' even when the resolved audience was
-- empty or every recipient send failed, showing a false-positive "Sent"
-- badge. Adds a 'failed' status so that case is distinguishable.

alter table review_campaigns drop constraint if exists review_campaigns_status_check;
alter table review_campaigns add constraint review_campaigns_status_check
  check (status in ('draft', 'scheduled', 'sent', 'active', 'failed'));
