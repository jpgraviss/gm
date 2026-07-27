-- AUDIT — knowledge_articles.helpful_count/not_helpful_count and
-- funnel_pages.views/conversions still used a plain read-then-write
-- increment, unlike this codebase's established atomic-RPC pattern
-- (increment_kb_article_views, increment_broadcast_clicked,
-- increment_review_campaign_counts). Concurrent feedback submissions,
-- page views, or form conversions on the same row could race and lose
-- an increment.

create or replace function increment_kb_article_feedback(
  p_id      text,
  p_column  text
) returns void as $$
begin
  if p_column not in ('helpful_count', 'not_helpful_count') then
    raise exception 'invalid column %', p_column;
  end if;
  execute format('update knowledge_articles set %I = %I + 1 where id = $1', p_column, p_column)
    using p_id;
end;
$$ language plpgsql;

create or replace function increment_funnel_page_views(
  p_id text
) returns void as $$
  update funnel_pages
  set views = coalesce(views, 0) + 1
  where id = p_id;
$$ language sql;

create or replace function increment_funnel_page_conversions(
  p_id text
) returns void as $$
  update funnel_pages
  set conversions = coalesce(conversions, 0) + 1
  where id = p_id;
$$ language sql;
