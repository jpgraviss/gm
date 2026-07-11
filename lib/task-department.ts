// Department scoping for app_tasks. Operations/Sales/Marketing/Finance/CRM
// tasks are logically separate — a Finance team member should never see an
// Operations task and vice versa. Enforced server-side in the tasks API,
// not just hidden in the UI.

export const TASK_DEPARTMENTS = ['Operations', 'Sales', 'Marketing', 'Finance', 'CRM', 'General'] as const
export type TaskDepartment = typeof TASK_DEPARTMENTS[number]

// team_members.unit -> the task department that unit is scoped to. Units
// with no clean mapping (e.g. no dedicated Marketing unit exists yet) fall
// through to the caller-sees-only-their-own-assignments fallback.
const UNIT_TO_DEPARTMENT: Record<string, TaskDepartment> = {
  'Delivery/Operations': 'Operations',
  'Delivery': 'Operations',
  'Sales': 'Sales',
  'Billing/Finance': 'Finance',
}

export function departmentForUnit(unit: string | null | undefined): TaskDepartment | null {
  if (!unit) return null
  return UNIT_TO_DEPARTMENT[unit] ?? null
}
