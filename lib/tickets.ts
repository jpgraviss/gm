// Shared by app/api/tickets/route.ts and app/api/tickets/[id]/route.ts —
// staff mark replies isInternal in the same messages array as
// client-visible ones (app/tickets/page.tsx), so every response that can
// reach a portal client must filter them out here rather than each route
// re-implementing (and potentially forgetting) the same filter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTicket(row: any, includeInternal: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (row.messages ?? []) as any[]
  return {
    id:            row.id,
    subject:       row.subject,
    company:       row.company,
    companyId:     row.company_id || null,
    contactName:   row.contact_name ?? '',
    contactEmail:  row.contact_email ?? '',
    status:        row.status,
    priority:      row.priority,
    source:        row.source,
    serviceType:   row.service_type,
    projectId:     row.project_id ?? undefined,
    assignedTo:    row.assigned_to ?? undefined,
    tags:          row.tags ?? [],
    messages:      includeInternal ? messages : messages.filter(m => !m?.isInternal),
    linkedTaskId:  row.linked_task_id ?? undefined,
    createdDate:   row.created_date ?? '',
    updatedDate:   row.updated_date ?? '',
  }
}
