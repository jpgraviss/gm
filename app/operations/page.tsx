'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  FolderKanban, CheckSquare, Clock, CalendarDays, CalendarCheck,
  Wrench, RefreshCw, PackageCheck, Zap, ArrowRight,
} from 'lucide-react'

const CARDS = [
  { title: 'Projects',      href: '/projects',               icon: <FolderKanban size={20} />,  color: '#015035', description: 'Active project boards' },
  { title: 'Tasks',         href: '/tasks',                  icon: <CheckSquare size={20} />,   color: '#3b82f6', description: 'To-dos and assignments' },
  { title: 'Time Tracking', href: '/time-tracking',          icon: <Clock size={20} />,         color: '#8b5cf6', description: 'Log and review hours' },
  { title: 'Calendar',      href: '/calendar',               icon: <CalendarDays size={20} />,  color: '#22c55e', description: 'Team schedule overview' },
  { title: 'Booking',       href: '/calendar/booking',       icon: <CalendarCheck size={20} />, color: '#0ea5e9', description: 'Client booking pages' },
  { title: 'Maintenance',   href: '/maintenance',            icon: <Wrench size={20} />,        color: '#f59e0b', description: 'Recurring maintenance tasks' },
  { title: 'Renewals',      href: '/renewals',               icon: <RefreshCw size={20} />,     color: '#ef4444', description: 'Upcoming contract renewals' },
  { title: 'Delivery',      href: '/crm/delivery-dashboard', icon: <PackageCheck size={20} />,  color: '#6366f1', description: 'Client delivery tracker' },
  { title: 'Automation',    href: '/automation',             icon: <Zap size={20} />,           color: '#ec4899', description: 'Workflow automations' },
]

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0],
  }
}

export default function OperationsHub() {
  const [activeProjects, setActiveProjects] = useState<number | null>(null)
  const [openTasks, setOpenTasks] = useState<number | null>(null)
  const [hoursThisWeek, setHoursThisWeek] = useState<number | null>(null)
  const [upcomingRenewals, setUpcomingRenewals] = useState<number | null>(null)

  useEffect(() => {
    const { weekStart, weekEnd } = getWeekBounds()

    Promise.all([
      fetch('/api/projects?limit=500').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/tasks?limit=500').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/time-entries?weekStart=${weekStart}&weekEnd=${weekEnd}&limit=500`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/renewals?limit=500').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([projects, tasks, timeEntries, renewals]) => {
      if (Array.isArray(projects)) {
        setActiveProjects(projects.filter((p: { status: string }) => p.status === 'In Progress').length)
      }
      if (Array.isArray(tasks)) {
        setOpenTasks(tasks.filter((t: { status: string }) => t.status === 'Pending' || t.status === 'In Progress').length)
      }
      if (Array.isArray(timeEntries)) {
        const total = timeEntries.reduce(
          (sum: number, e: { hours?: number; minutes?: number }) =>
            sum + (e.hours ?? 0) + (e.minutes ?? 0) / 60,
          0,
        )
        setHoursThisWeek(Math.round(total * 10) / 10)
      }
      if (Array.isArray(renewals)) {
        setUpcomingRenewals(
          renewals.filter(
            (r: { status: string; daysUntilExpiry: number }) =>
              r.status === 'Upcoming' && r.daysUntilExpiry <= 30,
          ).length,
        )
      }
    })
  }, [])

  const kpiItems = [
    { label: 'Active Projects',   value: activeProjects,   icon: <FolderKanban size={16} />, color: '#015035', href: '/projects' },
    { label: 'Open Tasks',        value: openTasks,         icon: <CheckSquare size={16} />,  color: '#3b82f6', href: '/tasks' },
    { label: 'Hours This Week',   value: hoursThisWeek,     icon: <Clock size={16} />,        color: '#8b5cf6', href: '/time-tracking' },
    { label: 'Upcoming Renewals', value: upcomingRenewals,  icon: <RefreshCw size={16} />,    color: '#f59e0b', href: '/renewals' },
  ]

  return (
    <>
      <Header title="Operations" subtitle="Projects, tasks, and delivery" />
      <main className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiItems.map(k => (
            <Link key={k.label} href={k.href} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: k.color + '14', color: k.color }}>
                {k.icon}
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
                <p className="text-lg font-bold text-gray-900">
                  {k.value === null ? (
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin align-middle" />
                  ) : (
                    String(k.value)
                  )}
                </p>
              </div>
            </Link>
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
