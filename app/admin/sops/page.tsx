'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { Printer } from 'lucide-react'

const LAST_UPDATED = 'May 17, 2026'

interface Section {
  id: string
  title: string
  steps: string[]
  tips?: string[]
}

const sections: Section[] = [
  {
    id: 'new-client-onboarding',
    title: 'New Client Onboarding',
    steps: [
      'Create a new contact in the CRM with the client\'s business info and assign a deal.',
      'Send a proposal via the Proposal Builder. Include scope, pricing, and timeline.',
      'Once the proposal is accepted, generate a contract and send for e-signature.',
      'After the contract is signed, create an invoice for the first billing period.',
      'Set up the project in Projects with tasks based on the 8-step delivery system.',
      'Provision portal access for the client so they can track progress.',
      'Schedule the kickoff call and send the welcome email from the portal.',
      'Assign the account manager and delivery team members to the project.',
    ],
    tips: [
      'Use the 8-step system: Discovery, Strategy, Setup, Build, Launch, Optimize, Report, Renew.',
      'Always send the welcome email within 24 hours of contract signing.',
    ],
  },
  {
    id: 'portal-management',
    title: 'Portal Management',
    steps: [
      'Navigate to Admin > Portal Management to view all portal clients.',
      'Click "Invite Client" to send a portal setup link via email.',
      'The client completes setup by setting a password and verifying their email.',
      'Approve the client in the admin panel once setup is complete.',
      'Assign services and projects to control what the client can see in their portal.',
      'Use the visibility settings to show/hide reports, invoices, and project details.',
      'Review portal activity in the audit log to track client engagement.',
    ],
    tips: [
      'Approval notifications are configurable in Settings > Notifications > Approval Settings.',
      'Clients only see data explicitly assigned to their portal account.',
    ],
  },
  {
    id: 'proposal-to-contract',
    title: 'Proposal to Contract Flow',
    steps: [
      'Open the CRM and navigate to the deal you want to send a proposal for.',
      'Click "Create Proposal" and use the Proposal Builder to add sections, pricing, and terms.',
      'Preview the proposal and send it to the client via email.',
      'Track the proposal status in the Proposals tab (Sent, Viewed, Accepted, Declined).',
      'When the client accepts, click "Generate Contract" to auto-fill contract details.',
      'Review the contract, add any custom clauses, and send for e-signature.',
      'Once signed, the deal stage updates automatically and an invoice can be generated.',
    ],
    tips: [
      'Proposals can be duplicated to save time on similar deals.',
      'Use engagement tracking to see when a client opens or views a proposal.',
    ],
  },
  {
    id: 'monthly-reporting',
    title: 'Monthly Reporting',
    steps: [
      'Navigate to the client\'s project and click "Generate Report".',
      'Select the reporting period and the metrics to include (traffic, rankings, conversions).',
      'Review the auto-generated report and add any custom commentary.',
      'Send the report to the client via email or make it available in their portal.',
      'Log the report delivery as a CRM activity for tracking.',
    ],
    tips: [
      'Reports pull data from connected integrations (Google Analytics, Search Console, etc.).',
      'Schedule reports in advance using the automation engine for recurring delivery.',
    ],
  },
  {
    id: 'rank-tracker',
    title: 'Rank Tracker',
    steps: [
      'Go to Rank Tracker and click "Add Keywords" for a client.',
      'Enter target keywords, select the search engine, and set the location.',
      'Connect Google Search Console to pull actual ranking data automatically.',
      'Review ranking trends on the dashboard and identify opportunities.',
      'Share rank reports with clients by enabling the data in their portal.',
    ],
    tips: [
      'GSC sync runs daily. Manual refreshes are available for on-demand checks.',
      'Group keywords by topic or landing page for cleaner reporting.',
    ],
  },
  {
    id: 'ticket-handling',
    title: 'Ticket Handling',
    steps: [
      'Tickets arrive in the CRM from client portal submissions or internal creation.',
      'Triage the ticket: assign a priority (Low, Medium, High, Urgent) and owner.',
      'Respond to the client within the SLA window (Urgent: 1 hour, High: 4 hours, Medium: 1 business day, Low: 2 business days).',
      'Update the ticket status as work progresses (Open, In Progress, Waiting, Resolved).',
      'Close the ticket once the client confirms resolution.',
      'Log time spent on the ticket for accurate billing and capacity tracking.',
    ],
    tips: [
      'Use canned responses for common issues to speed up reply times.',
      'Escalate tickets that exceed SLA thresholds to the team lead immediately.',
    ],
  },
  {
    id: 'time-tracking',
    title: 'Time Tracking',
    steps: [
      'Open Time Tracking from the sidebar and click "Start Timer" or "Log Time".',
      'Select the client, project, and task associated with the time entry.',
      'Add a description of the work performed.',
      'Submit the time entry for approval at the end of each day or week.',
      'Managers review and approve timesheets in the Time Tracking admin view.',
      'Approved time feeds into billing calculations and project profitability reports.',
    ],
    tips: [
      'Use the running timer for real-time tracking during active work.',
      'Review weekly summaries to catch missing entries before the approval deadline.',
    ],
  },
  {
    id: 'settings-configuration',
    title: 'Settings & Configuration',
    steps: [
      'Company: Set your business name, address, phone, and timezone in Settings > Company.',
      'Branding: Customize colors, logo text, and app name in Settings > Branding.',
      'Email Defaults: Configure from name, reply-to address, and footer text in Settings > Email Defaults.',
      'Email Templates: Customize system email templates (welcome, notifications) in Settings > Email Templates.',
      'Integrations: Connect Google, QuickBooks, Gmail, and other services in Settings > Integrations.',
      'CRM Setup: Configure pipelines, stages, service types, and contact tags in Settings > CRM Setup.',
      'Notifications: Set activity notification channels and quiet hours in Settings > Notifications.',
      'Navigation: Customize sidebar layout and role-based visibility in Settings > Navigation.',
    ],
    tips: [
      'Changes to branding and email defaults apply globally across all emails and the portal.',
      'Use role-based navigation to show different sidebar items to different team roles.',
    ],
  },
]

export default function SOPsPage() {
  const [activeSection, setActiveSection] = useState(sections[0].id)

  return (
    <>
      <Header title="Standard Operating Procedures" subtitle="Internal team reference" />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto print:p-0">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <p className="text-xs text-gray-400">Last updated: {LAST_UPDATED}</p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>

        <div className="flex gap-6">
          <nav className="hidden lg:block w-56 flex-shrink-0 print:hidden">
            <div className="sticky top-20 bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Table of Contents</h3>
              <ul className="space-y-1">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setActiveSection(s.id)
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                        activeSection === s.id
                          ? 'bg-[#015035]/10 text-[#015035] font-semibold'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}. {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="flex-1 min-w-0 space-y-8">
            {sections.map((section, sectionIdx) => (
              <section
                key={section.id}
                id={section.id}
                className="bg-white rounded-xl border border-gray-200 p-5 sm:p-7 print:border-0 print:shadow-none print:p-4 print:break-inside-avoid"
              >
                <div className="flex items-baseline gap-3 mb-5">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                    {sectionIdx + 1}
                  </span>
                  <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                    {section.title}
                  </h2>
                </div>

                <ol className="space-y-3 mb-5">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>

                {section.tips && section.tips.length > 0 && (
                  <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-4">
                    <p className="text-[10px] font-bold text-[#015035] uppercase tracking-wider mb-2">Tips</p>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-xs text-gray-600">
                          <span className="text-[#015035] font-bold flex-shrink-0">*</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-8 print:mt-4">
          Graviss Marketing - Internal SOPs - {LAST_UPDATED}
        </p>
      </div>

      <style jsx global>{`
        @media print {
          nav, header, button, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:p-4 { padding: 1rem !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:mt-4 { margin-top: 1rem !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </>
  )
}
