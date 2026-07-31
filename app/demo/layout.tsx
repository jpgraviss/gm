import type { Metadata } from 'next'
import { DemoSidebar, DemoMobileNav } from './DemoNav'

export const metadata: Metadata = {
  title: 'GravHub Demo',
  description: 'A walkthrough of GravHub — pipeline, proposals, the client portal, and reporting.',
  robots: { index: false, follow: false },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1B211D] flex" style={{ fontFamily: 'var(--font-body)' }}>
      <DemoSidebar />
      <div className="flex-1 min-w-0">
        <DemoMobileNav />
        {children}
      </div>
    </div>
  )
}
