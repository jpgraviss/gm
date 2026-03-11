-- ─────────────────────────────────────────────────────────────────────────────
-- GravHub Seed Data
-- Run this AFTER schema.sql in your Supabase SQL Editor.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING
--
-- NOTE: Supabase Auth users (email + password) must be created separately.
-- Use one of these methods:
--   1. Supabase Dashboard → Authentication → Users → Add user
--   2. POST /api/admin/setup  (see app/api/admin/setup/route.ts)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Team Members ──────────────────────────────────────────────────────────────
insert into team_members (id, name, email, role, unit, initials, is_admin) values
  ('t0', 'Jonathan Graviss', 'jonathan@gravissmarketing.com', 'Super Admin', 'Leadership/Admin', 'JG', true),
  ('t1', 'JG Graviss',       'jgraviss@gravissmarketing.com', 'Super Admin', 'Leadership/Admin', 'JG', true)
  ('t1', 'Graviss Marketing',       'test@gravissmarketing.com', 'Super Admin', 'Leadership/Admin', 'GM', true)
on conflict (id) do nothing;
