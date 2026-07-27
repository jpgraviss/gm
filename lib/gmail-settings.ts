// AUDIT.md #407 — team_members.gmail_settings (saved via POST /api/gmail/token,
// see supabase/migrations/add_gmail_settings.sql for the column default) was
// write-only: nothing in the send/inbound/tracking code paths read it back.
// This is the shared shape + defaults every real enforcement call site
// (app/api/gmail/send, app/api/gmail/message, app/api/track/open/[id])
// reads against, mirroring app/settings/page.tsx's local `gmailPrefs` state
// (kept in sync by hand — that page is a 'use client' component, not a
// shared module).
export interface GmailSettings {
  autoLogSent: boolean
  autoLogInbound: boolean
  trackOpens: boolean
  trackClicks: boolean
  insertSignature: boolean
  notifyOnReply: boolean
  notifyOnOpen: boolean
}

export const GMAIL_SETTINGS_DEFAULTS: GmailSettings = {
  autoLogSent: true,
  autoLogInbound: false,
  trackOpens: false,
  trackClicks: false,
  insertSignature: true,
  notifyOnReply: true,
  notifyOnOpen: false,
}

export function resolveGmailSettings(raw: unknown): GmailSettings {
  return {
    ...GMAIL_SETTINGS_DEFAULTS,
    ...(raw && typeof raw === 'object' ? raw as Partial<GmailSettings> : {}),
  }
}
