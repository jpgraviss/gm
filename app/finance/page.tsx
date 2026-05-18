'use client'

import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  CreditCard, BarChart3, DollarSign, FileBarChart, Plug,
  Activity, ArrowRight, Users,
} from 'lucide-react'

const KPI_ITEMS = [
  { label: 'Revenue This Month', value: '—', icon: <DollarSign size={16} />, color: '#015035' },
  { label: 'Outstanding Invoices', value: '—', icon: <CreditCard size={16} />, color: '#ef4444' },
  { label: 'MRR', value: '—', icon: <BarChart3 size={16} />, color: '#3b82f6' },
  { label: 'Active Clients', value: '—', icon: <Users size={16} />, color: '#22c55e' },
]

const CARDS = [
  { title: 'Billing & Invoices', href: '/billing',         icon: <CreditCard size={20} />,   color: '#015035', description: 'Invoices, payments, and billing' },
  { title: 'Reports',           href: '/reports',          icon: <BarChart3 size={20} />,    color: '#3b82f6', description: 'Business analytics and reports' },
  { title: 'Revenue Reports',   href: '/reports/revenue',  icon: <DollarSign size={20} />,   color: '#22c55e', description: 'Revenue breakdowns and trends' },
  { title: 'Client Reports',    href: '/reports/client',   icon: <FileBarChart size={20} />, color: '#8b5cf6', description: 'Per-client performance data' },
  { title: 'Integrations',      href: '/integrations',     icon: <Plug size={20} />,         color: '#f59e0b', description: 'Connected apps and services' },
  { title: 'Monitoring',        href: '/monitoring',       icon: <Activity size={20} />,     color: '#ef4444', description: 'System health and uptime' },
]

export default function FinanceHub() {
  return (
    <>
      <Header title="Finance" subtitle="Billing, reporting, and revenue" />
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
