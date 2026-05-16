-- Add user access control columns to team_members
alter table public.team_members
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_until   timestamptz,
  add column if not exists suspended_reason  text,
  add column if not exists access_schedule   jsonb,
  add column if not exists deleted_at        timestamptz;

-- Update existing status values: normalize 'Active'/'Inactive' to lowercase
-- and add check constraint for valid status values
do $$
begin
  -- Normalize existing rows
  update public.team_members set status = 'active' where lower(status) = 'active';
  update public.team_members set status = 'suspended' where lower(status) = 'inactive';

  -- Drop old check constraint if it exists, then add new one
  begin
    alter table public.team_members drop constraint if exists team_members_status_check;
  exception when others then null;
  end;

  alter table public.team_members
    add constraint team_members_status_check
    check (status in ('active', 'suspended', 'deleted'));

  -- Update default
  alter table public.team_members alter column status set default 'active';
end $$;
