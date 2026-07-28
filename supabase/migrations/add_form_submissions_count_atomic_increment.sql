-- AUDIT.md #498 — forms.submissions_count used a plain read-then-write
-- increment (app/api/forms/public/[slug]/route.ts: `.update({ submissions_count:
-- (form.submissions_count ?? 0) + 1 })`), the same counter-race class already
-- fixed via RPC everywhere else in this codebase (funnel_pages.views/
-- conversions, knowledge_articles.helpful_count/not_helpful_count — see
-- add_kb_feedback_funnel_atomic_counts.sql — plus increment_kb_article_views,
-- increment_broadcast_clicked, increment_review_campaign_counts). Concurrent
-- submissions to a busy public form could race and lose an increment.

create or replace function increment_form_submissions_count(
  p_id text
) returns void as $$
  update forms
  set submissions_count = coalesce(submissions_count, 0) + 1
  where id = p_id;
$$ language sql;

-- NOTE: this migration has NOT been run against the live database — apply
-- manually.
