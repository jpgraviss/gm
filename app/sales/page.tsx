'use client'

import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  TrendingUp, Building2, Users, Zap, FileText, ScrollText,
  BookOpen, GraduationCap, DollarSign, Target, ArrowRight,
} from 'lucide-react'

const KPI_ITEMS = [
  { label: 'Active Deals', value: '—', icon: <Target size={16} />, color: '#015035' },
  { label: 'Pipeline Value', value: '—', icon: <TrendingUp size={16} />, color: '#3b82f6' },
  { label: 'Proposals Sent', value: '—', icon: <FileText size={16} />, color: '#8b5cf6' },
  { label: 'Contracts Signed', value: '—', icon: <ScrollText size={16} />, color: '#22c55e' },
]

const CARDS = [
  { title: 'Pipeline',         href: '/crm/pipeline',     icon: <TrendingUp size={20} />,   color: '#015035', description: 'Manage deals across stages' },
  { title: 'Companies',        href: '/crm/companies',    icon: <Building2 size={20} />,    color: '#3b82f6', description: 'View and manage company accounts' },
  { title: 'Contacts',         href: '/crm/contacts',     icon: <Users size={20} />,        color: '#6366f1', description: 'People and relationships' },
  { title: 'Sequences',        href: '/crm/sequences',    icon: <Zap size={20} />,          color: '#f59e0b', description: 'Automated outreach workflows' },
  { title: 'Proposals',        href: '/proposals',        icon: <FileText size={20} />,     color: '#8b5cf6', description: 'Create and track proposals' },
  { title: 'Contracts',        href: '/contracts',        icon: <ScrollText size={20} />,   color: '#22c55e', description: 'Manage signed agreements' },
  { title: 'Deals',            href: '/crm/pipeline',     icon: <DollarSign size={20} />,   color: '#ef4444', description: 'Pipeline deal board view' },
  { title: 'Sales Enablement', href: '/sales-enablement', icon: <BookOpen size={20} />,     color: '#0ea5e9', description: 'Resources and playbooks' },
  { title: 'Courses',          href: '/courses',          icon: <GraduationCap size={20} />, color: '#ec4899', description: 'Training and certifications' },
]

export default function SalesHub() {
  return (
    <>
      <Header title="Sales" subtitle="Pipeline, proposals, and revenue" />
      <main className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_ITEMS.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: k.color + '14', color: k.color }}>
                {k.icon}
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CARDS.map(c => (
            <Link
              key={c.title}
              href={c.href}
              className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + '14', color: c.color }}>
                  {c.icon}
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  )
}
