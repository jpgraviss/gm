-- Allow authenticated users to create their own team_members row on first login.
-- The RLS check ensures id must match the user's auth.uid(), preventing
-- users from creating rows for other people.
create policy "auth_self_insert_team_members"
  on public.team_members
  for insert
  to authenticated
  with check (id = auth.uid()::text);
