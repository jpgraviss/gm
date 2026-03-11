'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { fetchCrmCompanies, fetchCrmContacts } from '@/lib/supabase'

export default function CRMSubNav() {
  const pathname = usePathname()
  const [companyCount, setCompanyCount] = useState(0)
  const [contactCount, setContactCount] = useState(0)

  useEffect(() => {
    fetchCrmCompanies().then(data => setCompanyCount(data.length))
    fetchCrmContacts().then(data => setContactCount(data.length))
  }, [])

  const tabs = [
    { label: 'Pipeline', href: '/crm/pipeline' },
    { label: `Companies (${companyCount})`, href: '/crm/companies' },
    { label: `Contacts (${contactCount})`, href: '/crm/contacts' },
    { label: 'Sequences', href: '/crm/sequences' },
  ]
  return (
    <div className="flex gap-1 border-b border-gray-200 px-3 sm:px-6 pt-2 bg-white -mt-2 mb-5 overflow-x-auto">
      {tabs.map(t => (
        <Link key={t.href} href={t.href} className={`tab-btn flex-shrink-0 ${pathname === t.href ? 'active' : ''}`}>
          {t.label}
        </Link>
      ))}
    </div>
  )
}
