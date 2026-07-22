-- AUDIT.md #276 — knowledge_articles.views and courses.enrolled_count still
-- used a plain read-then-write increment/decrement, unlike this codebase's
-- established atomic-RPC pattern (adjust_sequence_counts,
-- increment_review_campaign_counts, increment_template_usage). Concurrent
-- views/enroll/unenroll calls could race and lose an increment.

create or replace function increment_kb_article_views(
  p_id text
) returns void as $$
  update knowledge_articles
  set views = views + 1
  where id = p_id;
$$ language sql;

create or replace function adjust_course_enrolled_count(
  p_id     text,
  p_delta  integer
) returns void as $$
  update courses
  set enrolled_count = greatest(0, enrolled_count + p_delta)
  where id = p_id;
$$ language sql;
