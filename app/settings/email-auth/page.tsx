'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import {
  Shield, CheckCircle, Copy, ChevronRight, ChevronDown,
  Circle, ExternalLink, Info,
} from 'lucide-react'

interface DnsRecord {
  type: string
  host: string
  value: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
      style={{
        background: copied ? '#015035' : '#f3f4f6',
        color: copied ? '#fff' : '#6b7280',
      }}
    >
      <Copy size={12} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function DnsRecordBlock({ record }: { record: DnsRecord }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="grid grid-cols-3 gap-4 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <span>Type</span>
        <span>Host</span>
        <span>Value</span>
      </div>
      <div className="grid grid-cols-3 gap-4 items-start">
        <span className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 w-fit">
          {record.type}
        </span>
        <code className="text-xs text-gray-700 font-mono break-all">{record.host}</code>
        <div className="flex items-start gap-2">
          <code className="text-xs text-gray-700 font-mono break-all flex-1 bg-white border border-gray-200 rounded-md px-2 py-1.5">
            {record.value}
          </code>
          <CopyButton text={record.value} />
        </div>
      </div>
    </div>
  )
}

interface AccordionSectionProps {
  step: number
  title: string
  description: string
  configured: boolean
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function AccordionSection({ step, title, description, configured, open, onToggle, children }: AccordionSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: '#015035' }}
        >
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {configured ? (
              <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
            ) : (
              <Circle size={15} className="text-gray-300 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        {open ? (
          <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

const checklistItems = [
  'SPF record added',
  'DKIM verified via Resend',
  'DMARC record published',
  'Verified sending domain',
  'Test email sent successfully',
]

export default function EmailAuthPage() {
  const [openSection, setOpenSection] = useState<number | null>(1)
  const [configured] = useState({ spf: false, dkim: false, dmarc: false })
  const [checklist, setChecklist] = useState<boolean[]>(new Array(checklistItems.length).fill(false))

  function toggleSection(step: number) {
    setOpenSection(prev => (prev === step ? null : step))
  }

  function toggleChecklist(index: number) {
    setChecklist(prev => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  return (
    <>
      <Header
        title="Email Domain Authentication"
        subtitle="Configure SPF, DKIM & DMARC for deliverability"
      />
      <div className="page-content">
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <Info size={16} className="text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Proper email authentication prevents your messages from landing in spam.
            Complete all three steps below to maximize deliverability.
          </p>
        </div>

        <div className="space-y-3">
          <AccordionSection
            step={1}
            title="SPF (Sender Policy Framework)"
            description="Specifies which mail servers are authorized to send email on behalf of your domain"
            configured={configured.spf}
            open={openSection === 1}
            onToggle={() => toggleSection(1)}
          >
            <div className="space-y-4 mt-3">
              <p className="text-sm text-gray-600">
                SPF tells receiving servers which IP addresses and services are allowed to send mail for your domain.
              </p>
              <DnsRecordBlock
                record={{
                  type: 'TXT',
                  host: '@',
                  value: 'v=spf1 include:amazonses.com include:_spf.google.com ~all',
                }}
              />
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                <Shield size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Add this to your domain&apos;s DNS settings. If you already have an SPF record, merge the includes.
                </p>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            step={2}
            title="DKIM (DomainKeys Identified Mail)"
            description="Adds a digital signature to outgoing emails to verify they haven't been tampered with"
            configured={configured.dkim}
            open={openSection === 2}
            onToggle={() => toggleSection(2)}
          >
            <div className="space-y-4 mt-3">
              <p className="text-sm text-gray-600">
                DKIM cryptographically signs your emails so recipients can verify the message originated from your domain and wasn&apos;t altered in transit.
              </p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                <p className="text-xs text-emerald-700 font-medium">
                  Resend handles DKIM signing automatically once you verify your domain. Add the CNAME records below to complete verification.
                </p>
              </div>
              <div className="space-y-2">
                <DnsRecordBlock
                  record={{
                    type: 'CNAME',
                    host: 'resend._domainkey',
                    value: 'dkim1.resend.com',
                  }}
                />
                <DnsRecordBlock
                  record={{
                    type: 'CNAME',
                    host: 'resend2._domainkey',
                    value: 'dkim2.resend.com',
                  }}
                />
                <DnsRecordBlock
                  record={{
                    type: 'CNAME',
                    host: 'resend3._domainkey',
                    value: 'dkim3.resend.com',
                  }}
                />
              </div>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                Verify Domain
                <ExternalLink size={14} />
              </a>
            </div>
          </AccordionSection>

          <AccordionSection
            step={3}
            title="DMARC (Domain-based Message Authentication)"
            description="Tells receiving servers what to do when SPF or DKIM checks fail"
            configured={configured.dmarc}
            open={openSection === 3}
            onToggle={() => toggleSection(3)}
          >
            <div className="space-y-4 mt-3">
              <p className="text-sm text-gray-600">
                DMARC builds on SPF and DKIM by defining a policy for how receiving servers should handle messages that fail authentication.
              </p>
              <DnsRecordBlock
                record={{
                  type: 'TXT',
                  host: '_dmarc',
                  value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@gravissmarketing.com',
                }}
              />
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Policy Options</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <code className="text-[11px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 flex-shrink-0">
                      p=none
                    </code>
                    <p className="text-xs text-gray-500">Monitor only. No action taken on failing emails. Use this to start collecting reports.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="text-[11px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0" style={{ color: '#015035' }}>
                      p=quarantine
                    </code>
                    <p className="text-xs text-gray-500">Failing emails are sent to spam. Recommended for most setups.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <code className="text-[11px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 text-red-600 flex-shrink-0">
                      p=reject
                    </code>
                    <p className="text-xs text-gray-500">Failing emails are rejected entirely. Use only after thorough testing.</p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionSection>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Deliverability Checklist</h3>
          <div className="space-y-3">
            {checklistItems.map((item, i) => (
              <label key={i} className="flex items-center gap-3 cursor-pointer group">
                <div
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0"
                  style={{
                    borderColor: checklist[i] ? '#015035' : '#d1d5db',
                    background: checklist[i] ? '#015035' : 'transparent',
                  }}
                  onClick={() => toggleChecklist(i)}
                >
                  {checklist[i] && <CheckCircle size={12} className="text-white" />}
                </div>
                <span
                  className="text-sm transition-colors"
                  style={{ color: checklist[i] ? '#015035' : '#4b5563', textDecoration: checklist[i] ? 'line-through' : 'none' }}
                  onClick={() => toggleChecklist(i)}
                >
                  {item}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {checklist.filter(Boolean).length} of {checklistItems.length} completed
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
