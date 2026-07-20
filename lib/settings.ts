import { createServiceClient } from '@/lib/supabase'
import { BRAND_COLORS, BRAND_NAME } from '@/lib/brand'

export interface AppSettings {
  company: {
    name: string
    legalName: string
    email: string
    phone: string
    website: string
    address: { street: string; city: string; state: string; zip: string }
    timezone: string
    industry: string
    currency: string
    fiscalYearStart: string
  }
  branding: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    inkColor: string
    stoneColor: string
    darkBg: string
    logoText: string
    appName: string
  }
  email: {
    fromName: string
    fromEmail: string
    replyTo: string
    supportEmail: string
    footerText: string
    signatureRequestFrom: string
  }
  dashboard: {
    rotatingMessages: Array<{ sub: string; emoji: string }>
    greetings: {
      morning: string
      afternoon: string
      evening: string
      night: string
    }
  }
}

const DEFAULTS: AppSettings = {
  company: {
    name: 'Graviss Marketing',
    legalName: 'Graviss Marketing, LLC',
    email: 'info@gravissmarketing.com',
    phone: '+1 (830) 326-0320',
    website: 'gravissmarketing.com',
    address: { street: '', city: 'Kerrville', state: 'Texas', zip: '78028' },
    timezone: 'America/Chicago',
    industry: 'Marketing Agency',
    currency: 'USD',
    fiscalYearStart: 'January',
  },
  branding: {
    primaryColor: BRAND_COLORS.primary,
    secondaryColor: BRAND_COLORS.secondary,
    accentColor: BRAND_COLORS.accent,
    inkColor: BRAND_COLORS.ink,
    stoneColor: BRAND_COLORS.stone,
    darkBg: BRAND_COLORS.darkBg,
    logoText: BRAND_NAME.app,
    appName: BRAND_NAME.app,
  },
  email: {
    fromName: 'GravHub',
    fromEmail: 'noreply@app.gravissmarketing.com',
    replyTo: 'info@gravissmarketing.com',
    supportEmail: 'info@gravissmarketing.com',
    footerText: '',
    signatureRequestFrom: 'contracts@gravissmarketing.com',
  },
  dashboard: {
    rotatingMessages: [
      { sub: 'Revenue doesn\'t sleep. Neither does GravHub.', emoji: '🔥' },
      { sub: 'Every deal in your pipeline is a future payday.', emoji: '💰' },
      { sub: 'Outwork yesterday. Outclose tomorrow.', emoji: '🚀' },
      { sub: 'Your pipeline is your paycheck — keep it full.', emoji: '📈' },
      { sub: 'Closed is the only stage that pays.', emoji: '🎯' },
      { sub: 'Speed to lead. Speed to close. Speed to invoice.', emoji: '⚡' },
      { sub: 'The follow-up you skip is the deal you lose.', emoji: '📞' },
      { sub: 'A stale pipeline is a broke pipeline.', emoji: '💀' },
      { sub: 'Renewals are revenue you already earned. Go collect.', emoji: '💎' },
      { sub: 'You\'re not just selling — you\'re building an empire.', emoji: '👑' },
    ],
    greetings: {
      morning: 'Good Morning',
      afternoon: 'Good Afternoon',
      evening: 'Good Evening',
      night: 'Burning the midnight oil',
    },
  },
}

function deepMerge<T extends Record<string, unknown>>(defaults: T, overrides: Record<string, unknown>): T {
  const result = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const def = (defaults as Record<string, unknown>)[key]
    const over = overrides[key]
    if (over === undefined || over === null) continue
    if (typeof def === 'object' && !Array.isArray(def) && typeof over === 'object' && !Array.isArray(over)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        def as Record<string, unknown>,
        over as Record<string, unknown>,
      )
    } else {
      (result as Record<string, unknown>)[key] = over
    }
  }
  return result
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('company, branding, email_defaults, dashboard_config')
      .eq('id', 'global')
      .maybeSingle()

    if (!data) return DEFAULTS

    return {
      company: deepMerge(DEFAULTS.company, (data.company as Record<string, unknown>) ?? {}),
      branding: deepMerge(DEFAULTS.branding, (data.branding as Record<string, unknown>) ?? {}),
      email: deepMerge(DEFAULTS.email, (data.email_defaults as Record<string, unknown>) ?? {}),
      dashboard: deepMerge(DEFAULTS.dashboard, (data.dashboard_config as Record<string, unknown>) ?? {}),
    }
  } catch {
    return DEFAULTS
  }
}

export function getDefaults(): AppSettings {
  return DEFAULTS
}

// AUDIT.md #207 — security settings live in app_settings.security, a
// separate column from getSettings()'s deliberately curated public-safe
// subset above. This is the real enforcement-side read: every gate that
// needs to check Session Timeout/Password Policy/2FA/Login Attempts/Audit
// Logging/IP Restriction goes through here rather than re-querying
// individually, and shares one short-lived in-memory cache so a setting
// read on nearly every request (this function is called from logAudit(),
// the auth-resolution path, and login routes) doesn't add a DB round trip
// per call. Matches the same "in-memory is fine for a small team" tradeoff
// proxy.ts's rate limiter already documents — a change here can take up to
// CACHE_TTL_MS to take effect across all server instances.
export interface SecuritySettings {
  sessionTimeout: '1h' | '4h' | '8h' | '24h' | 'never'
  passwordPolicy: 'basic' | 'strong' | 'very-strong'
  twoFactor: 'disabled' | 'optional' | 'required'
  loginAttempts: number | 'unlimited'
  auditLogging: boolean
  ipRestriction: string
}

export const SECURITY_DEFAULTS: SecuritySettings = {
  sessionTimeout: '8h',
  passwordPolicy: 'strong',
  twoFactor: 'optional',
  loginAttempts: 5,
  auditLogging: true,
  ipRestriction: 'disabled',
}

const CACHE_TTL_MS = 30_000
let cachedSecurity: { value: SecuritySettings; expiresAt: number } | null = null

// AUDIT.md #207 — Password Policy's 3 tiers are described purely by
// minimum length in their own UI labels ("Basic (6+ chars)", "Strong (8+
// chars)", "Very Strong (12+ chars)") — enforcing exactly that, not
// inventing complexity rules (uppercase/symbols/etc.) the UI never
// promised.
export function passwordPolicyMinLength(policy: SecuritySettings['passwordPolicy']): number {
  if (policy === 'basic') return 6
  if (policy === 'very-strong') return 12
  return 8
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (cachedSecurity && cachedSecurity.expiresAt > Date.now()) return cachedSecurity.value
  try {
    const db = createServiceClient()
    const { data } = await db.from('app_settings').select('security').eq('id', 'global').maybeSingle()
    const value: SecuritySettings = { ...SECURITY_DEFAULTS, ...(data?.security as Partial<SecuritySettings> ?? {}) }
    cachedSecurity = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  } catch {
    return SECURITY_DEFAULTS
  }
}
