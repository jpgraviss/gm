-- ─── Form styling + tracking enhancements ──────────────────────────────────
alter table public.forms
  add column if not exists primary_color   text not null default '#015035',
  add column if not exists text_color      text not null default '#111827',
  add column if not exists bg_color        text not null default '#f9fafb',
  add column if not exists bg_transparent  boolean not null default false,
  add column if not exists font_family     text not null default 'system-ui',
  add column if not exists button_text     text not null default 'Submit';
