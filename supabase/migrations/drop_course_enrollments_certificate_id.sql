-- AUDIT.md #262 — course_enrollments.certificate_id was schema/API plumbing
-- with zero implementation behind it: no auto-generation on course
-- completion, no UI to view/download a certificate anywhere in the app.
-- Confirmed via full-repo search there is no live consumer (unlike other
-- "dead field" findings that turned out to have an active-but-broken UI).
-- Product decision: drop it rather than build real certificate generation.
--
-- The column was added by add_sales_enablement.sql, which has been updated
-- in place to no longer define it (this codebase's convention is a single
-- create-table statement per feature migration, not a consolidated
-- schema.sql — course_enrollments was never in schema.sql to begin with).
--
-- NOTE: this migration has NOT been run against the live database — apply
-- manually.

alter table public.course_enrollments drop column if exists certificate_id;
