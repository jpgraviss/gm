-- Sales-enablement training completion/checklist progress previously lived
-- only in browser localStorage (app/sales-enablement/page.tsx) — no
-- team-wide visibility, and lost on storage clear or device switch.
-- One row per (user, content item).

create table if not exists public.training_progress (
  id              text primary key,
  user_email      text not null,
  content_id      text not null,
  completed       boolean not null default false,
  checklist_state jsonb not null default '{}',
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_training_progress_user_content
  on public.training_progress(user_email, content_id);

alter table public.training_progress enable row level security;
create policy "auth_read_training_progress" on public.training_progress for select to authenticated using (true);
