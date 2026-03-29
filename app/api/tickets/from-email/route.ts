import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const db = createServiceClient()

    // Get Gmail access token from app_settings
    const { data: settings } = await db
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .single()

    const gmailToken = (settings as any)?.gmail_access_token
    if (!gmailToken) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    // Fetch recent unread messages from Gmail
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread',
      { headers: { Authorization: `Bearer ${gmailToken}` } }
    )
    if (!listRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch Gmail messages' }, { status: 502 })
    }
    const listData = await listRes.json()
    const messageIds = (listData.messages ?? []).map((m: any) => m.id)

    if (messageIds.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0 })
    }

    // Check which messages are already processed
    const { data: processed } = await db
      .from('processed_emails')
      .select('gmail_message_id')
      .in('gmail_message_id', messageIds)
    const processedIds = new Set((processed ?? []).map(p => p.gmail_message_id))

    // Get CRM contacts for email matching
    const { data: contacts } = await db.from('crm_contacts').select('emails, company_name, full_name')
    const { data: companies } = await db.from('crm_companies').select('name')

    let created = 0
    let skipped = 0

    for (const msgId of messageIds) {
      if (processedIds.has(msgId)) { skipped++; continue }

      // Fetch full message
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${gmailToken}` } }
      )
      if (!msgRes.ok) { skipped++; continue }
      const msg = await msgRes.json()

      // Extract headers
      const headers = msg.payload?.headers ?? []
      const fromHeader = headers.find((h: any) => h.name === 'From')?.value ?? ''
      const subject = headers.find((h: any) => h.name === 'Subject')?.value ?? 'No Subject'
      const dateHeader = headers.find((h: any) => h.name === 'Date')?.value ?? ''

      // Extract sender email
      const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<]+@[^\s>]+)/)
      const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : ''
      const senderName = fromHeader.replace(/<[^>]+>/, '').trim().replace(/"/g, '')

      // Skip internal emails
      if (senderEmail.endsWith('@gravissmarketing.com')) {
        // Mark as processed but don't create ticket
        await db.from('processed_emails').insert({
          id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          gmail_message_id: msgId,
        })
        skipped++
        continue
      }

      // Match sender to CRM contact/company
      let matchedCompany = ''
      for (const contact of contacts ?? []) {
        if (contact.emails?.some((e: string) => e.toLowerCase() === senderEmail)) {
          matchedCompany = contact.company_name || ''
          break
        }
      }
      if (!matchedCompany) {
        // Try domain matching
        const domain = senderEmail.split('@')[1]
        for (const company of companies ?? []) {
          if (company.name?.toLowerCase().includes(domain?.split('.')[0] ?? '')) {
            matchedCompany = company.name
            break
          }
        }
      }

      // Extract body text
      let body = ''
      function extractText(part: any): string {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64url').toString('utf-8')
        }
        if (part.parts) {
          for (const p of part.parts) {
            const text = extractText(p)
            if (text) return text
          }
        }
        return ''
      }
      body = extractText(msg.payload) || subject

      // Create ticket
      const ticketId = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      await db.from('tickets').insert({
        id: ticketId,
        subject,
        company: matchedCompany || 'Unknown',
        status: 'Open',
        priority: 'Medium',
        source: 'Email',
        assigned_to: '',
        created_date: dateHeader ? new Date(dateHeader).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        tags: [],
        messages: [{
          id: `msg-${Date.now()}`,
          author: senderName || senderEmail,
          text: body.slice(0, 5000),
          date: new Date().toISOString(),
          internal: false,
        }],
        gmail_message_id: msgId,
      })

      // Mark as processed
      await db.from('processed_emails').insert({
        id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gmail_message_id: msgId,
        ticket_id: ticketId,
      })

      created++
    }

    return NextResponse.json({ created, skipped })
  } catch (err) {
    console.error('[tickets/from-email]', err)
    return NextResponse.json({ error: 'Failed to process emails' }, { status: 500 })
  }
}
