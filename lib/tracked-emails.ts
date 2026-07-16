import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Mirrors a Gmail-extension tracked-email open/click onto the CRM contact's
 * activity timeline — same integration point sequence/broadcast tracking
 * already writes to, so all three tracking sources show up in one place on
 * the contact record regardless of which channel actually sent the email.
 */
export async function mirrorTrackedEmailActivity(
  db: SupabaseClient,
  trackedEmail: { id: string; contact_id: string | null; company_id: string | null; recipient_email: string; subject: string | null; team_member_id: string },
  title: string,
): Promise<void> {
  if (!trackedEmail.contact_id) return

  const [{ data: contactRow }, { data: memberRow }] = await Promise.all([
    db.from('crm_contacts').select('full_name').eq('id', trackedEmail.contact_id).maybeSingle(),
    db.from('team_members').select('name').eq('id', trackedEmail.team_member_id).maybeSingle(),
  ])

  await db.from('crm_activities').insert({
    id: `act-ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'email',
    title,
    company_id: trackedEmail.company_id,
    contact_id: trackedEmail.contact_id,
    contact_name: contactRow?.full_name ?? null,
    user_name: memberRow?.name ?? 'System',
    timestamp: new Date().toISOString(),
  })
}
