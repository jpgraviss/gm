import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()

  const { data, error } = await db
    .from('time_entries')
    .select('*')
    .eq('billable', true)
    .or('invoiced.is.null,invoiced.eq.false')
    .order('date', { ascending: false })

  if (error) {
    console.error('[time-entries/billable-summary GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch billable summary' }, { status: 500 })
  }

  // Group by project/company
  const groups: Record<string, {
    projectName: string
    projectId: string | null
    entries: typeof data
    totalHours: number
    totalMinutes: number
  }> = {}

  for (const entry of data ?? []) {
    const key = entry.project_name || 'Unassigned'
    if (!groups[key]) {
      groups[key] = {
        projectName: key,
        projectId: entry.project_id,
        entries: [],
        totalHours: 0,
        totalMinutes: 0,
      }
    }
    groups[key].entries.push(entry)
    groups[key].totalMinutes += (entry.hours ?? 0) * 60 + (entry.minutes ?? 0)
  }

  // Convert total minutes to hours + minutes
  const summary = Object.values(groups).map(g => ({
    projectName: g.projectName,
    projectId: g.projectId,
    totalHours: Math.floor(g.totalMinutes / 60),
    totalMinutes: g.totalMinutes % 60,
    entryCount: g.entries.length,
    entries: g.entries.map(e => ({
      id: e.id,
      date: e.date,
      description: e.description,
      teamMember: e.team_member,
      hours: e.hours,
      minutes: e.minutes,
      serviceType: e.service_type,
    })),
  }))

  return NextResponse.json(summary)
}
