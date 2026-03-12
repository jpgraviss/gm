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
  ('t0', 'Jonathan Graviss',  'jonathan@gravissmarketing.com', 'Super Admin',        'Leadership/Admin',    'JON', true),
  ('t1', 'JG Graviss',        'jgraviss@gravissmarketing.com', 'Super Admin',        'Leadership/Admin',    'JG',  true),
  ('t3', 'Shihab Sarkar',     'ssarkar@gravissmarketing.com',  'Team Member',        'Delivery/Operations', 'SS',  false),
  ('t4', 'Team SEO',          'seo@gravissmarketing.com',      'Team Member',        'Delivery/Operations', 'SE',  false),
  ('t5', 'Graviss Billing',   'billing@gravissmarketing.com',  'Department Manager', 'Billing/Finance',     'GB',  true),
  ('t2', 'Graviss Marketing', 'test@gravissmarketing.com',     'Team Member',        'Leadership/Admin',    'GM',  false)
on conflict (id) do nothing;
