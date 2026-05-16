import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const now = Date.now()
  const runs = [
    {
      id: 'r_a3f8c1',
      automation_id: id,
      timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      trigger_contact: { name: 'Sarah Chen', email: 'sarah@acme.co' },
      status: 'success' as const,
      actions_completed: 5,
      actions_total: 5,
      steps: [
        { name: 'Contact Created', status: 'success' as const, duration_ms: 12 },
        { name: 'Send Email', status: 'success' as const, duration_ms: 340 },
        { name: 'Add Tag', status: 'success' as const, duration_ms: 45 },
        { name: 'Create Task', status: 'success' as const, duration_ms: 89 },
        { name: 'Slack Message', status: 'success' as const, duration_ms: 210 },
      ],
    },
    {
      id: 'r_7b2e0d',
      automation_id: id,
      timestamp: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      trigger_contact: { name: 'James Rivera', email: 'james@globex.io' },
      status: 'failed' as const,
      actions_completed: 2,
      actions_total: 4,
      steps: [
        { name: 'Deal Stage Changed', status: 'success' as const, duration_ms: 8 },
        { name: 'Send Email', status: 'success' as const, duration_ms: 290 },
        { name: 'Update Contact', status: 'failed' as const, duration_ms: 1200, error: 'Contact field "lifecycle_stage" is read-only for this record' },
        { name: 'Send Notification', status: 'skipped' as const, duration_ms: 0 },
      ],
    },
    {
      id: 'r_e9c4a2',
      automation_id: id,
      timestamp: new Date(now - 30 * 1000).toISOString(),
      trigger_contact: { name: 'Priya Patel', email: 'priya@nova.dev' },
      status: 'running' as const,
      actions_completed: 1,
      actions_total: 3,
      steps: [
        { name: 'Form Submitted', status: 'success' as const, duration_ms: 15 },
        { name: 'Send Email', status: 'running' as const, duration_ms: 0 },
        { name: 'Create Deal', status: 'pending' as const, duration_ms: 0 },
      ],
    },
    {
      id: 'r_1d5f38',
      automation_id: id,
      timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      trigger_contact: { name: 'Marcus Thompson', email: 'marcus@orbit.com' },
      status: 'success' as const,
      actions_completed: 3,
      actions_total: 3,
      steps: [
        { name: 'Invoice Paid', status: 'success' as const, duration_ms: 10 },
        { name: 'Add Tag', status: 'success' as const, duration_ms: 38 },
        { name: 'Log Activity', status: 'success' as const, duration_ms: 55 },
      ],
    },
  ]

  return NextResponse.json(runs)
}
