import { describe, it, expect } from 'vitest'
import { generateICS } from '@/lib/ics-generator'

// AUDIT #606 — escapeICSText() escaped backslash/semicolon/comma/\n but not
// a bare \r. Guest-supplied booking.notes flows into the public,
// unauthenticated .ics download with no other character filtering beyond
// length, so a lone \r could inject additional bogus ICS lines in clients
// lenient about CR-only line terminators.

function baseEvent(description: string) {
  return {
    title: 'Meeting',
    startDateTime: '2026-08-01T09:00',
    endDateTime: '2026-08-01T09:30',
    timezone: 'America/Chicago',
    description,
    location: '',
    organizerName: 'Jamie Rep',
    organizerEmail: 'jamie@gravissmarketing.com',
    attendeeEmail: 'guest@example.com',
    uid: 'test-uid@gravhub',
  }
}

describe('escapeICSText — bare \\r handling (#606)', () => {
  it('strips a lone \\r (not paired with \\n) from the description', () => {
    const ics = generateICS(baseEvent('line one\rSUMMARY:Injected Event'))

    expect(ics).not.toContain('\r\rSUMMARY')
    // The literal CR must not survive into the folded DESCRIPTION line raw
    const descLine = ics.split('\r\n').find(l => l.startsWith('DESCRIPTION:'))
    expect(descLine).toBeDefined()
    expect(descLine).not.toMatch(/[^\\]\r/)
  })

  it('still correctly escapes a real \\r\\n pair as the \\n line-break sequence', () => {
    const ics = generateICS(baseEvent('line one\r\nline two'))

    expect(ics).toContain('DESCRIPTION:line one\\nline two')
  })

  it('still escapes backslash/semicolon/comma as before', () => {
    const ics = generateICS(baseEvent('a\\b;c,d'))

    expect(ics).toContain('DESCRIPTION:a\\\\b\\;c\\,d')
  })
})
