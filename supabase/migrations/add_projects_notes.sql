-- Add notes and overview columns to projects table
alter table public.projects add column if not exists notes jsonb not null default '[]';
alter table public.projects add column if not exists overview text not null default '';
