import { createServiceClient } from './supabase'

export async function notifyPortalClient(
  portalClientId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
) {
  const db = createServiceClient()
  const id = `pn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  // Insert notification
  await db.from('portal_notifications').insert({
    id, portal_client_id: portalClientId, type, title, message, link,
  })

  // Get client email for sending notification email
  const { data: client } = await db.from('portal_clients')
    .select('email, name, company')
    .eq('id', portalClientId)
    .single()

  if (!client?.email) return

  // Send email via internal API
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await fetch(`${baseUrl}/api/email/portal-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: client.email,
        clientName: client.name || client.company,
        title,
        message,
        link,
      }),
    })
  } catch (err) {
    console.error('[portal-notify] email failed:', err)
  }
}
