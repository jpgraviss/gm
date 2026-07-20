-- AUDIT.md #167 — sales_templates.usage_count was a plain read-then-write
-- (read the current count in application code, write back +1) in both
-- app/sales-enablement/page.tsx's applyTemplate and the POST route's
-- useTemplate path. Two reps copying the same template in the same render
-- window could lose one increment. Same class of fix as next_rotation_index()/
-- upsert_training_progress()/adjust_sequence_counts() (add_race_condition_fixes.sql,
-- add_sequence_count_rpc.sql) — the increment happens inside a single atomic
-- UPDATE, under the row's own lock, instead of split across a SELECT and a
-- separate write.
create or replace function public.increment_template_usage(p_id text)
returns int
language sql
as $$
  update public.sales_templates
  set usage_count = coalesce(usage_count, 0) + 1,
      updated_at = now()
  where id = p_id
  returning usage_count;
$$;
