-- Department-scoped tasks: separates Operations/Sales/Marketing/Finance/CRM
-- tasks so e.g. Finance staff can't see Operations tasks and vice versa.
-- Enforced in app/api/tasks/route.ts GET (server-side filter), not just UI.

alter table public.app_tasks
  add column if not exists department text;

comment on column public.app_tasks.department is
  'Operations | Sales | Marketing | Finance | CRM | General (untagged legacy tasks). Leadership/Admin/Super Admin see all departments; other roles are restricted to their own.';
