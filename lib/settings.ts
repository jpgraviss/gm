import { createServiceClient } from '@/lib/supabase'

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
    primaryColor: '#015035',
    secondaryColor: '#FFF3EA',
    accentColor: '#CC7853',
    inkColor: '#1B211D',
    stoneColor: '#8C8478',
    darkBg: '#012b1e',
    logoText: 'GravHub',
    appName: 'GravHub',
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
