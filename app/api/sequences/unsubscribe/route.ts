import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') ?? ''
  const seq = req.nextUrl.searchParams.get('seq') ?? ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f4f4f5; color: #374151; }
    .card { background: #fff; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { font-size: 22px; margin: 0 0 12px; color: #012b1e; }
    p { font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    button { background: #012b1e; color: #fff; border: none; border-radius: 8px; padding: 12px 32px; font-size: 15px; cursor: pointer; }
    button:hover { background: #015035; }
    .done { display: none; }
    .done.show { display: block; }
    .form.hide { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="form" id="formSection">
      <h1>Unsubscribe</h1>
      <p>Click the button below to unsubscribe <strong>${escapeHtml(email)}</strong> from future sequence emails.</p>
      <button id="unsubBtn" onclick="doUnsubscribe()">Unsubscribe</button>
    </div>
    <div class="done" id="doneSection">
      <h1>Unsubscribed</h1>
      <p>You've been unsubscribed from future emails. You can close this page.</p>
    </div>
  </div>
  <script>
    async function doUnsubscribe() {
      const btn = document.getElementById('unsubBtn');
      btn.disabled = true;
      btn.textContent = 'Processing...';
      try {
        await fetch('/api/sequences/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ${JSON.stringify(email)}, seq: ${JSON.stringify(seq)} }),
        });
      } catch (e) { /* proceed anyway */ }
      document.getElementById('formSection').classList.add('hide');
      document.getElementById('doneSection').classList.add('show');
    }
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  let body: { email?: string; seq?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Add to global suppression list (unique on email)
  await db.from('sequence_suppression_list').upsert(
    {
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email,
      reason: 'unsubscribed',
      source: body.seq || null,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  )

  // Find all active enrollments for this email and unenroll them
  const { data: activeEnrollments } = await db
    .from('sequence_enrollments')
    .select('id, sequence_id')
    .eq('contact_email', email)
    .eq('status', 'active')

  if (activeEnrollments?.length) {
    const enrollmentIds = activeEnrollments.map((e: { id: string }) => e.id)

    await db
      .from('sequence_enrollments')
      .update({ status: 'unenrolled', unenroll_reason: 'unsubscribed' })
      .in('id', enrollmentIds)

    // Update active_count for each affected sequence
    const sequenceIds = Array.from(new Set(activeEnrollments.map((e: { sequence_id: string }) => e.sequence_id)))
    for (const seqId of sequenceIds) {
      const countInSeq = activeEnrollments.filter((e: { sequence_id: string }) => e.sequence_id === seqId).length
      const { data: seq } = await db
        .from('sequences')
        .select('active_count')
        .eq('id', seqId)
        .single()
      if (seq) {
        await db
          .from('sequences')
          .update({ active_count: Math.max(0, (seq.active_count ?? 0) - countInSeq) })
          .eq('id', seqId)
      }
    }

    // Insert activity records
    const activities = activeEnrollments.map((e: { id: string; sequence_id: string }) => ({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sequence_id: e.sequence_id,
      enrollment_id: e.id,
      contact_email: email,
      step_index: 0,
      event_type: 'unsubscribed',
      created_at: new Date().toISOString(),
    }))
    await db.from('sequence_activities').insert(activities)

    // Reset in_sequence flag for contacts matching this email
    await db.from('crm_contacts').update({
      in_sequence: false,
      current_sequence_id: null,
    }).contains('emails', [email])
  }

  return NextResponse.json({ ok: true, unsubscribed: email })
}
