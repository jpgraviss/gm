'use client'

import { useState, useRef } from 'react'
import { X, Download, Save, FileText, Plus, Minus, Check } from 'lucide-react'
import type { Proposal, ProposalLineItem, ServiceType } from '@/lib/types'

// ─── Pricing Constants ────────────────────────────────────────────────────────

const WEBSITE_MGMT_MONTHLY = 350
const SEO_PRICES: Record<'basic' | 'standard' | 'premium', number> = {
  basic: 550,
  standard: 700,
  premium: 900,
}

interface Addon {
  id: string
  label: string
  price: number
  hasQty: boolean
  qtyLabel?: string
  defaultQty: number
}

const SETUP_ADDONS: Addon[] = [
  { id: 'custom-design',    label: 'Custom Design',          price: 600, hasQty: false, defaultQty: 1 },
  { id: 'conversion-opt',   label: 'Conversion Optimization',price: 450, hasQty: false, defaultQty: 1 },
  { id: 'copywriting',      label: 'Copywriting',            price: 150, hasQty: true,  qtyLabel: 'pages',  defaultQty: 5 },
  { id: 'blog-setup',       label: 'Blog Setup',             price: 400, hasQty: false, defaultQty: 1 },
  { id: 'blog-posts',       label: 'Blog Posts',             price: 250, hasQty: true,  qtyLabel: 'posts',  defaultQty: 4 },
  { id: 'custom-form',      label: 'Custom Form',            price: 250, hasQty: false, defaultQty: 1 },
  { id: 'integrations',     label: 'Integrations',           price: 150, hasQty: true,  qtyLabel: 'each',   defaultQty: 2 },
  { id: 'basic-seo',        label: 'Basic On-Page SEO',      price: 350, hasQty: false, defaultQty: 1 },
  { id: 'technical-seo',    label: 'Technical SEO',          price: 450, hasQty: false, defaultQty: 1 },
  { id: 'local-seo',        label: 'Local SEO',              price: 350, hasQty: false, defaultQty: 1 },
  { id: 'gbp-optimization', label: 'GBP Optimization',       price: 300, hasQty: false, defaultQty: 1 },
  { id: 'analytics-setup',  label: 'Analytics Setup',        price: 250, hasQty: false, defaultQty: 1 },
  { id: 'speed-optimization',label: 'Speed Optimization',    price: 350, hasQty: false, defaultQty: 1 },
  { id: 'revision-rounds',  label: 'Revision Rounds',        price: 250, hasQty: true,  qtyLabel: 'each',   defaultQty: 2 },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddonState { enabled: boolean; qty: number }
type SeoPackage = 'none' | 'basic' | 'standard' | 'premium'

interface Props {
  onSave: (proposal: Omit<Proposal, 'id' | 'dealId' | 'createdDate'>) => void
  onClose: () => void
  initialCompany?: string
  initialRep?: string
  initialData?: Proposal
}

const ALL_REPS = ['Jaycee Graviss', 'Alex Thompson', 'Maria Chen', 'Jordan Williams']

function fmt(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

// ─── PDF Template ─────────────────────────────────────────────────────────────

interface PdfProps {
  company: string; contactName: string; contactEmail: string; rep: string; today: string
  execSummary: string; clientGoals: string
  solutions: string[]
  timeline: Array<{ phase: string; duration: string; tasks: string }>
  oneTimeItems: ProposalLineItem[]; recurringItems: ProposalLineItem[]
  setupTotal: number; monthlyTotal: number; contractMonths: number
  subtotal: number; discount: number; discountAmount: number; grandTotal: number
}

function PdfTemplate(p: PdfProps) {
  const BG = '#012b1e'
  const GREEN = '#015035'
  const ACCENT = '#4ade80'

  const sectionTitle = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 4, height: 28, background: GREEN, borderRadius: 2 }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: BG, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>{text}</div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Montserrat, Arial, sans-serif', color: '#1a1a1a', background: '#ffffff' }}>

      {/* ── Cover ── */}
      <div style={{ background: BG, padding: '56px 64px 48px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '40%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(1,80,53,0.3)' }} />

        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: '0.25em', fontFamily: 'Syncopate, Arial, sans-serif' }}>GRAVISS</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.35em', marginTop: 2 }}>MARKETING</div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 11, color: ACCENT, letterSpacing: '0.3em', marginBottom: 12 }}>CUSTOM MARKETING PROPOSAL</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: '#ffffff', margin: '0 0 8px', lineHeight: 1.1, fontFamily: 'Syncopate, Arial, sans-serif', letterSpacing: '0.03em' }}>
          {p.company ? p.company.toUpperCase() : 'YOUR COMPANY'}
        </h1>
        <div style={{ width: 64, height: 3, background: ACCENT, borderRadius: 2, marginBottom: 32 }} />

        {/* Info row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderLeft: `3px solid ${ACCENT}`, padding: '14px 20px', borderRadius: '0 8px 8px 0' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', marginBottom: 4 }}>PREPARED FOR</div>
            {p.contactName && <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{p.contactName}</div>}
            {p.contactEmail && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{p.contactEmail}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', marginBottom: 4 }}>PREPARED BY</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{p.rep}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{p.today}</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '48px 64px', display: 'flex', flexDirection: 'column', gap: 44 }}>

        {/* Executive Summary */}
        {(p.execSummary || p.company) && (
          <section>
            {sectionTitle('Executive Summary')}
            <p style={{ fontSize: 13, lineHeight: 1.8, color: '#374151' }}>
              {p.execSummary || `Thank you for the opportunity to present this proposal to ${p.company}. At Graviss Marketing, we craft data-driven strategies tailored to your unique goals — delivering measurable growth, brand authority, and a stronger digital presence. This proposal outlines a comprehensive solution designed specifically for your business.`}
            </p>
          </section>
        )}

        {/* Goals */}
        {(p.clientGoals || p.solutions.length > 0) && (
          <section>
            {sectionTitle('Your Goals & Our Approach')}
            {p.clientGoals && (
              <p style={{ fontSize: 13, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>{p.clientGoals}</p>
            )}
            {p.solutions.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {p.solutions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f0fdf4', padding: '12px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#166534', lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Pricing */}
        <section>
          {sectionTitle('Investment Overview')}

          {p.oneTimeItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em', marginBottom: 10 }}>ONE-TIME SETUP</div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', background: '#f9fafb', padding: '8px 16px', gap: 0 }}>
                  <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>DESCRIPTION</div>
                  <div style={{ width: 60, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>QTY</div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>UNIT</div>
                  <div style={{ width: 90, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>TOTAL</div>
                </div>
                {p.oneTimeItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', padding: '10px 16px', borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <div style={{ flex: 1, fontSize: 12, color: '#1f2937' }}>{item.description}</div>
                    <div style={{ width: 60, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{item.quantity}</div>
                    <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{fmt(item.unitPrice)}</div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{fmt(item.total)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Setup Total: {fmt(p.setupTotal)}</div>
                </div>
              </div>
            </div>
          )}

          {p.recurringItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em', marginBottom: 10 }}>RECURRING SERVICES</div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', background: '#f9fafb', padding: '8px 16px' }}>
                  <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>SERVICE</div>
                  <div style={{ width: 70, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>MONTHS</div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>/MO</div>
                  <div style={{ width: 90, textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.1em' }}>TOTAL</div>
                </div>
                {p.recurringItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', padding: '10px 16px', borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <div style={{ flex: 1, fontSize: 12, color: '#1f2937' }}>{item.description}</div>
                    <div style={{ width: 70, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{item.quantity}</div>
                    <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{fmt(item.unitPrice)}/mo</div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{fmt(item.total)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>
                    Monthly Total: {fmt(p.monthlyTotal)}/mo × {p.contractMonths} = {fmt(p.monthlyTotal * p.contractMonths)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grand total box */}
          <div style={{ background: BG, borderRadius: 12, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.2em', marginBottom: 6 }}>TOTAL INVESTMENT</div>
              {p.discount > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through', marginBottom: 2 }}>{fmt(p.subtotal)}</div>
              )}
              {p.discount > 0 && (
                <div style={{ fontSize: 11, color: ACCENT, marginBottom: 4 }}>Discount ({p.discount}%): −{fmt(p.discountAmount)}</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#ffffff', fontFamily: 'Syncopate, Arial, sans-serif', letterSpacing: '0.03em' }}>{fmt(p.grandTotal)}</div>
              {p.monthlyTotal > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                  {fmt(p.setupTotal)} setup + {fmt(p.monthlyTotal)}/mo × {p.contractMonths} months
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Timeline */}
        {p.timeline.length > 0 && (
          <section>
            {sectionTitle('Project Timeline')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {p.timeline.map((phase, i) => (
                <div key={i} style={{ display: 'flex', gap: 0, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    </div>
                    {i < p.timeline.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 20, background: '#e5e7eb', margin: '2px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingLeft: 16, paddingBottom: i < p.timeline.length - 1 ? 20 : 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{phase.phase}</div>
                      <div style={{ fontSize: 11, color: GREEN, fontWeight: 600, background: '#f0fdf4', padding: '2px 8px', borderRadius: 4 }}>{phase.duration}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{phase.tasks}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Why Graviss */}
        <section style={{ background: '#f9fafb', borderRadius: 12, padding: '28px 32px', border: '1px solid #e5e7eb' }}>
          {sectionTitle('Why Graviss Marketing')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { title: 'Results-Driven', body: 'Every strategy is built around measurable KPIs and transparent reporting.' },
              { title: 'Dedicated Team', body: 'A committed account team that knows your business inside and out.' },
              { title: 'Full-Service', body: 'From design to SEO to content — everything under one roof.' },
            ].map((item, i) => (
              <div key={i} style={{ borderTop: `3px solid ${GREEN}`, paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: BG, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Acceptance */}
        <section>
          {sectionTitle('Proposal Acceptance')}
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7, marginBottom: 28 }}>
            This proposal is valid for 30 days from the date of issue. To proceed, please sign below and return a copy. Upon acceptance, we will send a formal contract and invoice for the initial payment.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.15em', marginBottom: 40 }}>CLIENT SIGNATURE</div>
              <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 6 }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{p.contactName || 'Authorized Representative'} · {p.company}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.15em', marginBottom: 40 }}>DATE</div>
              <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 6 }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>Date of Acceptance</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div style={{ background: BG, padding: '20px 64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em' }}>GRAVISS MARKETING</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Confidential · {p.today}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{p.rep}</div>
      </div>
    </div>
  )
}

// ─── Main Builder Component ───────────────────────────────────────────────────

export default function ProposalBuilderPanel({ onSave, onClose, initialCompany = '', initialRep = 'Jaycee Graviss', initialData }: Props) {
  // Client info
  const [company, setCompany]           = useState(initialData?.company ?? initialCompany)
  const [contactName, setContactName]   = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [rep, setRep]                   = useState(initialData?.assignedRep ?? initialRep)
  const [discount, setDiscount]         = useState(0)

  // Website build
  const [websiteEnabled, setWebsiteEnabled] = useState(true)
  const [websiteFee, setWebsiteFee]         = useState<string>('3500')

  // Setup addons
  const [addons, setAddons] = useState<Record<string, AddonState>>(
    Object.fromEntries(SETUP_ADDONS.map(a => [a.id, { enabled: false, qty: a.defaultQty }]))
  )

  // Monthly services
  const [websiteMgmt, setWebsiteMgmt]     = useState(false)
  const [seoPackage, setSeoPackage]       = useState<SeoPackage>('none')
  const [contractMonths, setContractMonths] = useState(6)

  // Content
  const [execSummary, setExecSummary] = useState('')
  const [clientGoals, setClientGoals] = useState('')

  // UI state
  const [generating, setGenerating] = useState(false)
  const pdfRef = useRef<HTMLDivElement>(null)

  // ─── Calculations ─────────────────────────────────────────────────────────

  const websiteSetupCost = websiteEnabled ? (parseFloat(websiteFee) || 0) : 0

  const addonsCost = SETUP_ADDONS.reduce((sum, addon) => {
    const state = addons[addon.id]
    if (!state?.enabled) return sum
    return sum + addon.price * (addon.hasQty ? state.qty : 1)
  }, 0)

  const setupTotal     = websiteSetupCost + addonsCost
  const monthlyWebsite = websiteMgmt ? WEBSITE_MGMT_MONTHLY : 0
  const monthlySEO     = seoPackage !== 'none' ? SEO_PRICES[seoPackage] : 0
  const monthlyTotal   = monthlyWebsite + monthlySEO
  const subtotal       = setupTotal + monthlyTotal * contractMonths
  const discountAmount = Math.round(subtotal * (discount / 100))
  const grandTotal     = subtotal - discountAmount

  // ─── Auto-generated content ───────────────────────────────────────────────

  function getAutoSolutions(): string[] {
    const s: string[] = []
    if (websiteEnabled)
      s.push(`Custom website designed to convert visitors into clients`)
    const active = SETUP_ADDONS.filter(a => addons[a.id]?.enabled)
    if (active.some(a => a.id === 'custom-design'))
      s.push('Custom visual design tailored to your brand identity and market positioning')
    if (active.some(a => ['basic-seo', 'technical-seo', 'local-seo'].includes(a.id)))
      s.push('Search engine optimization to improve visibility and attract organic traffic')
    if (active.some(a => a.id === 'copywriting'))
      s.push('Professional copywriting to communicate your value and drive action')
    if (active.some(a => ['blog-setup', 'blog-posts'].includes(a.id)))
      s.push('Content marketing strategy with blog infrastructure to build authority')
    if (active.some(a => a.id === 'analytics-setup'))
      s.push('Analytics & tracking setup for data-driven growth decisions')
    if (active.some(a => a.id === 'gbp-optimization'))
      s.push('Google Business Profile optimization to dominate local search results')
    if (websiteMgmt)
      s.push('Ongoing website management to keep your site secure and high-performing')
    if (seoPackage !== 'none')
      s.push(`Monthly ${seoPackage.charAt(0).toUpperCase() + seoPackage.slice(1)} SEO program to grow your search presence consistently`)
    return s
  }

  function getAutoTimeline(): Array<{ phase: string; duration: string; tasks: string }> {
    const phases: Array<{ phase: string; duration: string; tasks: string }> = []
    if (websiteEnabled) {
      phases.push({ phase: 'Phase 1 — Discovery & Strategy', duration: 'Week 1', tasks: 'Onboarding call, brand review, sitemap planning, content gathering' })
      phases.push({ phase: 'Phase 2 — Design',               duration: 'Weeks 2–3', tasks: 'Wireframes, visual mockups, client review and approval' })
      phases.push({ phase: 'Phase 3 — Development',          duration: 'Weeks 4–6', tasks: 'Full build, responsive development, integrations and QA' })
      phases.push({ phase: 'Phase 4 — Launch',               duration: 'Final Week', tasks: 'Client review, revisions, go-live and DNS transfer' })
    }
    const monthlyTasks: string[] = []
    if (seoPackage !== 'none') monthlyTasks.push('SEO reporting, keyword tracking, content optimization')
    if (websiteMgmt)           monthlyTasks.push('Site updates, security monitoring, performance checks')
    if (monthlyTasks.length > 0)
      phases.push({ phase: 'Ongoing — Monthly Services', duration: 'Monthly', tasks: monthlyTasks.join(' · ') })
    return phases
  }

  // ─── Build line items ─────────────────────────────────────────────────────

  function buildLineItems(): ProposalLineItem[] {
    const items: ProposalLineItem[] = []
    let idx = 0

    if (websiteEnabled) {
      items.push({ id: `item-${idx++}`, description: `Website Development`, type: 'one-time', quantity: 1, unitPrice: websiteSetupCost, total: websiteSetupCost })
    }

    SETUP_ADDONS.forEach(addon => {
      const state = addons[addon.id]
      if (!state?.enabled) return
      const qty   = addon.hasQty ? state.qty : 1
      const total = addon.price * qty
      items.push({ id: `item-${idx++}`, description: addon.hasQty ? `${addon.label} (${qty} ${addon.qtyLabel})` : addon.label, type: 'one-time', quantity: qty, unitPrice: addon.price, total })
    })

    if (websiteMgmt) {
      items.push({ id: `item-${idx++}`, description: 'Website Management & Maintenance', type: 'recurring', quantity: contractMonths, unitPrice: WEBSITE_MGMT_MONTHLY, total: WEBSITE_MGMT_MONTHLY * contractMonths })
    }

    if (seoPackage !== 'none') {
      const price = SEO_PRICES[seoPackage]
      items.push({ id: `item-${idx++}`, description: `SEO — ${seoPackage.charAt(0).toUpperCase() + seoPackage.slice(1)} Package`, type: 'recurring', quantity: contractMonths, unitPrice: price, total: price * contractMonths })
    }

    return items
  }

  function getServiceType(): ServiceType {
    if (websiteEnabled && seoPackage !== 'none') return 'Website'
    if (seoPackage !== 'none') return 'SEO'
    if (websiteEnabled) return 'Website'
    return 'Custom'
  }

  // ─── Save as draft ────────────────────────────────────────────────────────

  function handleSave() {
    onSave({
      company:      company || 'Unknown Company',
      status:       'Draft',
      value:        grandTotal,
      serviceType:  getServiceType(),
      assignedRep:  rep,
      items:        buildLineItems(),
    })
  }

  // ─── PDF generation ───────────────────────────────────────────────────────

  async function handleDownloadPDF() {
    if (!pdfRef.current) return
    setGenerating(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF }   = await import('jspdf')

      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')

      const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth  = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      const pageH     = pdf.internal.pageSize.getHeight()

      let yOffset = 0
      while (yOffset < pdfHeight) {
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfWidth, pdfHeight)
        yOffset += pageH
      }

      pdf.save(`Graviss-Proposal-${(company || 'Draft').replace(/\s+/g, '-')}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  // ─── Addon helpers ────────────────────────────────────────────────────────

  function toggleAddon(id: string) {
    setAddons(prev => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }))
  }
  function setAddonQty(id: string, qty: number) {
    setAddons(prev => ({ ...prev, [id]: { ...prev[id], qty: Math.max(1, qty) } }))
  }

  const solutions = getAutoSolutions()
  const timeline  = getAutoTimeline()
  const today     = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 overflow-hidden">
      {/* Click-away */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="pointer-events-auto flex flex-col bg-white shadow-2xl overflow-hidden" style={{ width: 'min(980px, 100vw)', height: '100vh' }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10" style={{ background: '#012b1e' }}>
          <div className="flex items-center gap-3">
            <FileText size={15} className="text-emerald-400" />
            <div>
              <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-heading)' }}>Proposal Builder</p>
              <p className="text-white/50 text-[11px]">Configure · Preview · Export PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!company}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white border border-emerald-600/40 hover:bg-emerald-600/20 transition-colors disabled:opacity-40"
            >
              <Save size={12} /> Save Draft
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={generating || !company}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              <Download size={12} className={generating ? 'animate-bounce' : ''} />
              {generating ? 'Generating…' : 'Download PDF'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X size={16} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* Body — 2 col */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — Calculator */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 border-r border-gray-100">

            {/* Client info */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Client Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Company Name *</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Contact Name</label>
                  <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Contact Email</label>
                  <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@acme.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Sales Rep</label>
                  <select value={rep} onChange={e => setRep(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    {ALL_REPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Discount %</label>
                  <input type="number" value={discount} min={0} max={50}
                    onChange={e => setDiscount(Math.min(50, Math.max(0, Number(e.target.value))))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
            </section>

            {/* Website build */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Website Build</p>
                <button
                  onClick={() => setWebsiteEnabled(v => !v)}
                  className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
                  style={{ background: websiteEnabled ? '#015035' : '#e5e7eb' }}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${websiteEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {websiteEnabled && (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Website Development Fee</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400">$</span>
                    <input
                      type="number"
                      value={websiteFee}
                      onChange={e => setWebsiteFee(e.target.value)}
                      placeholder="0"
                      min="0"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    {websiteSetupCost > 0 && (
                      <span className="text-sm font-bold text-gray-900 flex-shrink-0">{fmt(websiteSetupCost)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">Enter the total website development fee for this project</p>
                </div>
              )}
            </section>

            {/* Setup add-ons */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Setup Add-Ons</p>
              <div className="grid grid-cols-1 gap-1.5">
                {SETUP_ADDONS.map(addon => {
                  const state = addons[addon.id]
                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${state.enabled ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                      onClick={() => toggleAddon(addon.id)}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${state.enabled ? 'bg-emerald-600' : 'bg-white border-2 border-gray-300'}`}>
                        {state.enabled && <Check size={11} className="text-white" />}
                      </div>
                      <span className="flex-1 text-sm text-gray-700">{addon.label}</span>

                      {addon.hasQty && state.enabled ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setAddonQty(addon.id, state.qty - 1)} className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                            <Minus size={10} />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold">{state.qty}</span>
                          <button onClick={() => setAddonQty(addon.id, state.qty + 1)} className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                            <Plus size={10} />
                          </button>
                          <span className="text-[10px] text-gray-400">{addon.qtyLabel}</span>
                          <span className="text-xs font-bold text-emerald-700 ml-1 w-14 text-right">{fmt(addon.price * state.qty)}</span>
                        </div>
                      ) : (
                        <span className={`text-xs font-semibold ${state.enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {fmt(addon.price)}{addon.hasQty ? `/${addon.qtyLabel}` : ''}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Monthly services */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Monthly Services</p>
              <div className="flex flex-col gap-3">

                {/* Website management */}
                <div
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${websiteMgmt ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                  onClick={() => setWebsiteMgmt(v => !v)}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${websiteMgmt ? 'bg-emerald-600' : 'bg-white border-2 border-gray-300'}`}>
                    {websiteMgmt && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 font-medium">Website Management</p>
                    <p className="text-[11px] text-gray-400">Updates, maintenance, security</p>
                  </div>
                  <span className={`text-xs font-semibold ${websiteMgmt ? 'text-emerald-700' : 'text-gray-400'}`}>{fmt(WEBSITE_MGMT_MONTHLY)}/mo</span>
                </div>

                {/* SEO packages */}
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600 mb-2">SEO Package</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['none', 'basic', 'standard', 'premium'] as const).map(pkg => (
                      <button key={pkg} onClick={() => setSeoPackage(pkg)}
                        className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors ${seoPackage === pkg ? 'text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        style={seoPackage === pkg ? { background: '#015035' } : {}}>
                        {pkg === 'none' ? 'None' : pkg.charAt(0).toUpperCase() + pkg.slice(1)}
                        {pkg !== 'none' && <span className="block text-[9px] font-normal opacity-80">{fmt(SEO_PRICES[pkg])}/mo</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contract length */}
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">Contract Length</p>
                    <span className="text-xs font-bold text-gray-900">{contractMonths} months</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[3, 6, 12, 24].map(m => (
                      <button key={m} onClick={() => setContractMonths(m)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${contractMonths === m ? 'text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        style={contractMonths === m ? { background: '#015035' } : {}}>
                        {m}mo
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Proposal content */}
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Proposal Content</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Executive Summary</label>
                  <textarea value={execSummary} onChange={e => setExecSummary(e.target.value)} rows={3}
                    placeholder="Brief overview of the opportunity and approach (optional — auto-generated if left blank)"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">Client Goals</label>
                  <textarea value={clientGoals} onChange={e => setClientGoals(e.target.value)} rows={3}
                    placeholder="What is the client trying to achieve? Key objectives…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT — Live summary */}
          <div className="w-72 flex-shrink-0 overflow-y-auto p-5 bg-gray-50 flex flex-col gap-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Live Summary</p>

            {company && (
              <div className="mb-1">
                <p className="text-base font-bold text-gray-900">{company}</p>
                {contactName  && <p className="text-xs text-gray-500">{contactName}</p>}
                {contactEmail && <p className="text-xs text-gray-400">{contactEmail}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">{today}</p>
              </div>
            )}

            {setupTotal > 0 && (
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">One-Time Setup</p>
                <div className="flex flex-col gap-1.5">
                  {websiteEnabled && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Website Development</span>
                      <span className="font-semibold text-gray-800">{fmt(websiteSetupCost)}</span>
                    </div>
                  )}
                  {SETUP_ADDONS.filter(a => addons[a.id]?.enabled).map(a => (
                    <div key={a.id} className="flex justify-between text-xs">
                      <span className="text-gray-600">{a.label}{a.hasQty ? ` ×${addons[a.id].qty}` : ''}</span>
                      <span className="font-semibold text-gray-800">{fmt(a.price * (a.hasQty ? addons[a.id].qty : 1))}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-1.5 flex justify-between text-xs font-bold">
                    <span className="text-gray-700">Setup Total</span>
                    <span className="text-gray-900">{fmt(setupTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {monthlyTotal > 0 && (
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly × {contractMonths}mo</p>
                <div className="flex flex-col gap-1.5">
                  {websiteMgmt && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Website Mgmt</span>
                      <span className="font-semibold text-gray-800">{fmt(WEBSITE_MGMT_MONTHLY)}/mo</span>
                    </div>
                  )}
                  {seoPackage !== 'none' && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">SEO — {seoPackage.charAt(0).toUpperCase() + seoPackage.slice(1)}</span>
                      <span className="font-semibold text-gray-800">{fmt(SEO_PRICES[seoPackage])}/mo</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-1.5 flex justify-between text-xs font-bold">
                    <span className="text-gray-700">{contractMonths}-Mo Total</span>
                    <span className="text-gray-900">{fmt(monthlyTotal * contractMonths)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Grand total */}
            <div className="rounded-xl p-4" style={{ background: '#012b1e' }}>
              {discount > 0 && (
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-400 mb-2">
                  <span>Discount ({discount}%)</span><span>−{fmt(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline">
                <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">Total</span>
                <span className="text-white font-bold text-xl" style={{ fontFamily: 'var(--font-heading)' }}>{fmt(grandTotal)}</span>
              </div>
              {monthlyTotal > 0 && (
                <p className="text-white/35 text-[11px] mt-1">{fmt(monthlyTotal)}/mo for {contractMonths} months</p>
              )}
            </div>

            {/* Solutions list */}
            {solutions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Deliverables</p>
                <ul className="flex flex-col gap-1.5">
                  {solutions.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-600 leading-relaxed">
                      <span className="text-emerald-600 flex-shrink-0 mt-0.5 font-bold">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {timeline.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Timeline</p>
                <div className="flex flex-col gap-2">
                  {timeline.map((ph, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white mt-0.5" style={{ background: '#015035' }}>{i + 1}</div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{ph.phase}</p>
                        <p className="text-[10px] text-emerald-700">{ph.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden PDF template — captured by html2canvas */}
      <div
        ref={pdfRef}
        style={{ position: 'fixed', left: '-9999px', top: 0, width: '816px', background: '#ffffff', pointerEvents: 'none' }}
      >
        <PdfTemplate
          company={company}
          contactName={contactName}
          contactEmail={contactEmail}
          rep={rep}
          today={today}
          execSummary={execSummary}
          clientGoals={clientGoals}
          solutions={solutions}
          timeline={timeline}
          oneTimeItems={buildLineItems().filter(i => i.type === 'one-time')}
          recurringItems={buildLineItems().filter(i => i.type === 'recurring')}
          setupTotal={setupTotal}
          monthlyTotal={monthlyTotal}
          contractMonths={contractMonths}
          subtotal={subtotal}
          discount={discount}
          discountAmount={discountAmount}
          grandTotal={grandTotal}
        />
      </div>
    </div>
  )
}
