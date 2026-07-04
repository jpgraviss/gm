'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { computeMRR } from '@/lib/metrics'
import {
  CreditCard, BarChart3, DollarSign, FileBarChart, Plug,
  Activity, ArrowRight, Users, Landmark, RefreshCw,
} from 'lucide-react'

interface MercuryAccount {
  id: string
  name: string
  currentBalance: number
  availableBalance: number
  type: string
  status: string
}

interface MercuryTransaction {
  id: string
  amount: number
  counterpartyName: string
  bankDescription: string
  status: string
  createdAt: string
  kind: string
  note: string | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function FinanceHub() {
  const [mercuryAccounts, setMercuryAccounts] = useState<MercuryAccount[]>([])
  const [mercuryTxns, setMercuryTxns] = useState<MercuryTransaction[]>([])
  const [mercuryLoading, setMercuryLoading] = useState(true)
  const [mercuryError, setMercuryError] = useState('')
  const [dashData, setDashData] = useState<{ totalCollected: number; overdueInvoices: number; activeClients: number } | null>(null)
  const [contracts, setContracts] = useState<{ value: number; status: string; billingStructure: string }[]>([])

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.metrics) setDashData(d.metrics) })
      .catch(() => {})

    fetch('/api/contracts?limit=200')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setContracts(d) })
      .catch(() => {})

    setMercuryLoading(true)
    fetch('/api/mercury/accounts')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.accounts) {
          setMercuryAccounts(d.accounts)
          if (d.accounts[0]?.id) {
            fetch(`/api/mercury/transactions?accountId=${d.accounts[0].id}&limit=15`)
              .then(r => r.ok ? r.json() : null)
              .then(t => { if (t?.transactions) setMercuryTxns(t.transactions) })
              .catch(() => {})
          }
        }
      })
      .catch(() => setMercuryError('Mercury not connected'))
      .finally(() => setMercuryLoading(false))
  }, [])

  const mrr = computeMRR(contracts)

  const totalBalance = mercuryAccounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0)

  const KPI_ITEMS = [
    { label: 'Total Collected', value: dashData ? fmt(dashData.totalCollected) : '—', icon: <DollarSign size={16} />, color: '#015035' },
    { label: 'Overdue Invoices', value: dashData ? String(dashData.overdueInvoices) : '—', icon: <CreditCard size={16} />, color: '#ef4444' },
    { label: 'MRR', value: mrr ? fmt(mrr) : '—', icon: <BarChart3 size={16} />, color: '#3b82f6' },
    { label: 'Active Clients', value: dashData ? String(dashData.activeClients) : '—', icon: <Users size={16} />, color: '#22c55e' },
  ]

  const CARDS = [
    { title: 'Billing & Invoices', href: '/billing', icon: <CreditCard size={20} />, color: '#015035', description: 'Invoices, payments, and billing' },
    { title: 'Reports', href: '/reports', icon: <BarChart3 size={20} />, color: '#3b82f6', description: 'Business analytics and reports' },
    { title: 'Revenue Reports', href: '/reports/revenue', icon: <DollarSign size={20} />, color: '#22c55e', description: 'Revenue breakdowns and trends' },
    { title: 'Client Reports', href: '/reports/client', icon: <FileBarChart size={20} />, color: '#8b5cf6', description: 'Per-client performance data' },
    { title: 'Integrations', href: '/integrations', icon: <Plug size={20} />, color: '#f59e0b', description: 'Connected apps and services' },
    { title: 'Monitoring', href: '/monitoring', icon: <Activity size={20} />, color: '#ef4444', description: 'System health and uptime' },
  ]

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

        {/* Mercury Bank Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark size={16} className="text-gray-600" />
              <h2 className="text-sm font-bold text-gray-900">Mercury Banking</h2>
            </div>
            {mercuryLoading && <RefreshCw size={13} className="animate-spin text-gray-400" />}
          </div>

          {mercuryError ? (
            <div className="p-5 text-center">
              <p className="text-sm text-gray-500 mb-2">Mercury is not connected yet.</p>
              <p className="text-xs text-gray-400">Add your <code className="bg-gray-100 px-1.5 py-0.5 rounded">MERCURY_API_KEY</code> to environment variables.</p>
            </div>
          ) : mercuryAccounts.length > 0 ? (
            <div className="p-5 space-y-4">
              {/* Account balances */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {mercuryAccounts.map(acct => (
                  <div key={acct.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{acct.name}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{fmtFull(acct.currentBalance)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Available: {fmtFull(acct.availableBalance)}</p>
                  </div>
                ))}
                {mercuryAccounts.length > 1 && (
                  <div className="p-3 rounded-lg border border-green-100 bg-green-50/50">
                    <p className="text-[11px] font-medium text-green-600 uppercase tracking-wide">Total Balance</p>
                    <p className="text-xl font-bold text-green-800 mt-1">{fmtFull(totalBalance)}</p>
                  </div>
                )}
              </div>

              {/* Recent transactions */}
              {mercuryTxns.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Transactions</h3>
                  <div className="divide-y divide-gray-100">
                    {mercuryTxns.slice(0, 10).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {tx.counterpartyName || tx.bankDescription}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {tx.note && ` — ${tx.note}`}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold tabular-nums ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.amount < 0 ? '-' : '+'}{fmtFull(Math.abs(tx.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !mercuryLoading ? (
            <div className="p-5 text-center text-sm text-gray-400">No accounts found</div>
          ) : null}
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
