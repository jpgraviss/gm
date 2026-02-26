'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { teamMembers } from '@/lib/data'
import { Settings, Users, Shield, Bell, Palette, Building, Plus, Pencil } from 'lucide-react'

const membershipColors: Record<string, string> = {
  'Super Admin': 'bg-purple-100 text-purple-700',
  Leadership: 'bg-blue-100 text-blue-700',
  'Department Manager': 'bg-indigo-100 text-indigo-700',
  'Team Member': 'bg-gray-100 text-gray-600',
  Contractor: 'bg-yellow-100 text-yellow-700',
  Client: 'bg-green-100 text-green-700',
}

const tabs = ['Company', 'Team', 'Permissions', 'Branding', 'Notifications'] as const
type Tab = typeof tabs[number]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Company')

  return (
    <>
      <Header title="Settings" subtitle="Administration and configuration" />
      <div className="p-6 flex-1">
        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <div className="w-48 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2.5 border-b border-gray-100 last:border-0 ${
                    activeTab === tab
                      ? 'text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  style={{ background: activeTab === tab ? '#015035' : undefined }}
                >
                  {tab === 'Company' && <Building size={14} />}
                  {tab === 'Team' && <Users size={14} />}
                  {tab === 'Permissions' && <Shield size={14} />}
                  {tab === 'Branding' && <Palette size={14} />}
                  {tab === 'Notifications' && <Bell size={14} />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'Company' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Company Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Company Name', value: 'Graviss Marketing' },
                    { label: 'Industry', value: 'Marketing Agency' },
                    { label: 'Primary Email', value: 'info@gravissmarketing.com' },
                    { label: 'Phone', value: '+1 (555) 000-0000' },
                    { label: 'Website', value: 'www.gravissmarketing.com' },
                    { label: 'Timezone', value: 'America/New_York' },
                  ].map(field => (
                    <div key={field.label}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{field.label}</label>
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-800 flex-1">{field.value}</span>
                        <Pencil size={12} className="text-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-2">
                  <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'Team' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Team Members</h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                    <Plus size={13} /> Invite Member
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-2.5 px-6 font-semibold">Member</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Role</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Unit</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map(member => (
                      <tr key={member.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: '#015035' }}
                            >
                              {member.initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-400">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`status-badge ${membershipColors[member.role]}`}>{member.role}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">{member.unit}</span>
                        </td>
                        <td className="py-3 px-4">
                          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'Permissions' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Permission Matrix</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 pr-4 font-semibold text-gray-500 uppercase tracking-wide">Module</th>
                        {['Super Admin', 'Leadership', 'Dept Mgr', 'Team Member', 'Contractor', 'Client'].map(role => (
                          <th key={role} className="py-2 px-2 font-semibold text-gray-500 text-center uppercase tracking-wide">{role}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { module: 'Dashboard', perms: ['Full', 'Full', 'Full', 'Limited', 'None', 'None'] },
                        { module: 'CRM & Pipeline', perms: ['Full', 'Full', 'Unit', 'Assigned', 'None', 'None'] },
                        { module: 'Proposals', perms: ['Full', 'Full', 'Unit', 'Assigned', 'None', 'None'] },
                        { module: 'Contracts', perms: ['Full', 'Full', 'Summary', 'Summary', 'None', 'Executed'] },
                        { module: 'Billing', perms: ['Full', 'Full', 'Read', 'None', 'None', 'Own'] },
                        { module: 'Projects', perms: ['Full', 'Full', 'Full', 'Assigned', 'Assigned', 'Portal'] },
                        { module: 'Reports', perms: ['Full', 'Full', 'Unit', 'None', 'None', 'None'] },
                        { module: 'Settings', perms: ['Full', 'Read', 'Limited', 'None', 'None', 'None'] },
                      ].map(row => (
                        <tr key={row.module} className="border-b border-gray-50">
                          <td className="py-2.5 pr-4 font-semibold text-gray-700">{row.module}</td>
                          {row.perms.map((perm, i) => (
                            <td key={i} className="py-2.5 px-2 text-center">
                              <span className={`status-badge ${
                                perm === 'Full' ? 'bg-green-100 text-green-700' :
                                perm === 'None' ? 'bg-gray-100 text-gray-400' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{perm}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'Branding' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Brand Configuration</h3>
                <div className="flex flex-col gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-gray-200" style={{ background: '#015035' }} />
                      <div className="flex-1">
                        <input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50" defaultValue="#015035" />
                      </div>
                      <span className="text-xs text-gray-500">Deep Green</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-gray-200" style={{ background: '#FFF3EA' }} />
                      <div className="flex-1">
                        <input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50" defaultValue="#FFF3EA" />
                      </div>
                      <span className="text-xs text-gray-500">Soft Tan</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Heading Font</label>
                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800"
                      style={{ fontFamily: 'var(--font-syncopate), sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Syncopate — GRAVHUB
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Body Font</label>
                    <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">
                      Montserrat — The unified internal operating system
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Notifications' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Notification Preferences</h3>
                <div className="flex flex-col gap-4">
                  {[
                    { label: 'Contract requires signature', enabled: true },
                    { label: 'Invoice overdue by 3+ days', enabled: true },
                    { label: 'Renewal within 90 days', enabled: true },
                    { label: 'New deal created', enabled: false },
                    { label: 'Proposal viewed by client', enabled: true },
                    { label: 'Project milestone completed', enabled: true },
                    { label: 'Payment received', enabled: true },
                    { label: 'Client portal login', enabled: false },
                  ].map(n => (
                    <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{n.label}</span>
                      <button
                        className={`w-10 h-5.5 rounded-full relative transition-colors flex items-center px-0.5 ${n.enabled ? '' : 'bg-gray-200'}`}
                        style={{ background: n.enabled ? '#015035' : undefined, width: '40px', height: '22px' }}
                      >
                        <div
                          className="w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
                          style={{ transform: n.enabled ? 'translateX(18px)' : 'translateX(0px)' }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
