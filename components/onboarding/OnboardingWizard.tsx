'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, Plug, Palette, Rocket,
  ChevronRight, ChevronLeft, SkipForward, Check,
  Globe, Mail, Upload, ExternalLink,
} from 'lucide-react'

interface StepDef {
  id: string
  label: string
  icon: React.ReactNode
}

const STEPS: StepDef[] = [
  { id: 'company',      label: 'Company Info',        icon: <Building2 size={18} /> },
  { id: 'team',         label: 'Invite Team',         icon: <Users size={18} /> },
  { id: 'integrations', label: 'Connect Integrations', icon: <Plug size={18} /> },
  { id: 'branding',     label: 'Customize Branding',  icon: <Palette size={18} /> },
  { id: 'done',         label: "You're All Set!",     icon: <Rocket size={18} /> },
]

const INTEGRATION_LIST = [
  { id: 'google',     name: 'Google Workspace', desc: 'Calendar, Drive, Gmail', href: '/settings/email-auth', icon: '📧' },
  { id: 'resend',     name: 'Resend',      desc: 'Transactional email', href: '/integrations', icon: '📬' },
  { id: 'hubspot',    name: 'HubSpot',     desc: 'Import CRM data', href: '/integrations', icon: '🔶' },
]

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)

  const [companyName, setCompanyName] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [companyLogo, setCompanyLogo] = useState('')

  const [teamEmails, setTeamEmails] = useState<string[]>([''])
  const [inviteSending, setInviteSending] = useState(false)
  const [invitesSent, setInvitesSent] = useState(false)

  const [primaryColor, setPrimaryColor] = useState('#015035')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.company?.name) setCompanyName(data.company.name)
        if (data?.company?.website) setCompanyWebsite(data.company.website)
        if (data?.branding?.primaryColor) setPrimaryColor(data.branding.primaryColor)
      })
      .catch(() => {})
  }, [])

  function next() { setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  function prev() { setStep(s => Math.max(s - 1, 0)) }

  async function saveCompanyInfo() {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: { name: companyName, website: companyWebsite },
      }),
    }).catch(() => {})
    next()
  }

  async function sendInvites() {
    const valid = teamEmails.filter(e => e.trim() && e.includes('@'))
    if (valid.length === 0) { next(); return }
    setInviteSending(true)
    for (const email of valid) {
      await fetch('/api/email/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => {})
    }
    setInviteSending(false)
    setInvitesSent(true)
    setTimeout(next, 800)
  }

  async function saveBranding() {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branding: { primaryColor },
      }),
    }).catch(() => {})
    next()
  }

  async function finishOnboarding() {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_completed: true }),
    }).catch(() => {})
    onComplete()
    router.push('/')
  }

  const pct = ((step + 1) / STEPS.length) * 100

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{ width: `${pct}%`, background: '#015035' }}
          />
        </div>

        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-green-100 text-green-700' :
                  i === step ? 'text-white' : 'bg-gray-100 text-gray-400'
                }`}
                style={i === step ? { background: '#015035' } : undefined}
              >
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 rounded ${i < step ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="px-6 pb-2">
          <h2 className="text-lg font-bold text-gray-900">{STEPS[step].label}</h2>
        </div>

        <div className="px-6 py-4 min-h-[240px]">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company Name</label>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Website</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Globe size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={companyWebsite}
                    onChange={e => setCompanyWebsite(e.target.value)}
                    className="flex-1 text-sm bg-transparent outline-none"
                    placeholder="www.example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Logo URL</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Upload size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={companyLogo}
                    onChange={e => setCompanyLogo(e.target.value)}
                    className="flex-1 text-sm bg-transparent outline-none"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-500 mb-1">Invite your team members by email. They will receive a sign-in link.</p>
              {teamEmails.map((email, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-gray-50 px-3 py-2.5 flex-1">
                    <Mail size={14} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={email}
                      onChange={e => {
                        const updated = [...teamEmails]
                        updated[i] = e.target.value
                        setTeamEmails(updated)
                      }}
                      className="flex-1 text-sm bg-transparent outline-none"
                      placeholder="teammate@company.com"
                    />
                  </div>
                  {teamEmails.length > 1 && (
                    <button
                      onClick={() => setTeamEmails(teamEmails.filter((_, j) => j !== i))}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setTeamEmails([...teamEmails, ''])}
                className="text-xs font-medium hover:underline w-fit"
                style={{ color: '#015035' }}
              >
                + Add another email
              </button>
              {invitesSent && (
                <p className="text-xs text-green-600 font-medium mt-1">Invites sent!</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-500 mb-1">Connect your existing tools. You can always do this later in Settings.</p>
              {INTEGRATION_LIST.map(int => (
                <div key={int.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                  <span className="text-xl">{int.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{int.name}</p>
                    <p className="text-xs text-gray-400">{int.desc}</p>
                  </div>
                  <a
                    href={int.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                  >
                    Setup <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <input
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 w-32 font-mono"
                  />
                  <div className="flex-1">
                    <div className="h-10 rounded-lg" style={{ background: primaryColor }} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Logo URL</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Upload size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={companyLogo}
                    onChange={e => setCompanyLogo(e.target.value)}
                    className="flex-1 text-sm bg-transparent outline-none"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
              <div className="mt-2 p-4 rounded-xl border border-gray-200" style={{ background: `${primaryColor}08` }}>
                <p className="text-xs text-gray-500">Preview</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: primaryColor }}>
                    {companyName?.[0] ?? 'G'}
                  </div>
                  <span className="text-sm font-bold" style={{ color: primaryColor }}>{companyName || 'GravHub'}</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#01503518' }}>
                <Rocket size={28} style={{ color: '#015035' }} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">You&rsquo;re all set!</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                {companyName || 'Your workspace'} is ready to go. Head to the dashboard to start managing your business.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div>
            {step > 0 && step < 4 && (
              <button
                onClick={prev}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 && (
              <button
                onClick={next}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 font-medium"
              >
                <SkipForward size={12} /> Skip
              </button>
            )}

            {step === 0 && (
              <button
                onClick={saveCompanyInfo}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl"
                style={{ background: '#015035' }}
              >
                Next <ChevronRight size={14} />
              </button>
            )}

            {step === 1 && (
              <button
                onClick={sendInvites}
                disabled={inviteSending}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                {inviteSending ? 'Sending...' : 'Send Invites'} <ChevronRight size={14} />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={next}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl"
                style={{ background: '#015035' }}
              >
                Next <ChevronRight size={14} />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={saveBranding}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl"
                style={{ background: '#015035' }}
              >
                Save & Finish <ChevronRight size={14} />
              </button>
            )}

            {step === 4 && (
              <button
                onClick={finishOnboarding}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl"
                style={{ background: '#015035' }}
              >
                Go to Dashboard <Rocket size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
