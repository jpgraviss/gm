-- AUDIT #234 — portal_role is referenced across app/api/portal-clients/{route.ts,
-- [id]/route.ts, invite/route.ts, magic-link/verify/route.ts} (the last via an
-- explicit column-list .select(), which errors on every magic-link login if
-- the column doesn't exist) but has no CREATE/ALTER anywhere in schema.sql or
-- prior migrations. Confirmed genuinely missing via full grep — not just an
-- undocumented pre-existing column.

alter table portal_clients add column if not exists portal_role text not null default 'Viewer';
alter table portal_clients drop constraint if exists portal_clients_portal_role_check;
alter table portal_clients add constraint portal_clients_portal_role_check
  check (portal_role in ('Admin', 'Viewer'));
