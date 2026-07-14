-- Link review_requests back to the campaign that generated them (bulk
-- Review Campaigns dispatch) so sent/opened/reviews counts can be computed
-- honestly instead of staying hardcoded at 0. Requests created by the
-- existing single-send "Request Review" flow keep campaign_id null.
alter table review_requests add column if not exists campaign_id uuid references review_campaigns(id) on delete set null;
alter table review_requests add column if not exists opened_at timestamptz;

create index if not exists idx_review_requests_campaign on review_requests(campaign_id);

-- Atomic counter increments for review_campaigns — avoids read-then-write
-- races between the dispatch send loop, the public review-page "opened"
-- tracker, and the review-submission handler all updating the same row.
create or replace function increment_review_campaign_counts(
  p_campaign_id uuid,
  p_sent        integer default 0,
  p_opened      integer default 0,
  p_reviews     integer default 0
) returns void as $$
  update review_campaigns
  set sent_count    = sent_count + p_sent,
      opened_count  = opened_count + p_opened,
      reviews_count = reviews_count + p_reviews,
      updated_at    = now()
  where id = p_campaign_id;
$$ language sql;
