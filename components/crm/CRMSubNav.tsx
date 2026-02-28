'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { crmCompanies, crmContacts } from '@/lib/data'

export default function CRMSubNav() {
  const pathname = usePathname()
  const tabs = [
    { label: 'Pipeline', href: '/crm/pipeline' },
    { label: `Companies (${crmCompanies.length})`, href: '/crm/companies' },
    { label: `Contacts (${crmContacts.length})`, href: '/crm/contacts' },
    { label: 'Sequences', href: '/crm/sequences' },
  ]
  return (
    <div className="flex gap-1 border-b border-gray-200 px-6 pt-2 bg-white -mt-2 mb-5">
      {tabs.map(t => (
        <Link key={t.href} href={t.href} className={`tab-btn ${pathname === t.href ? 'active' : ''}`}>
          {t.label}
        </Link>
      ))}
    </div>
  )
}
