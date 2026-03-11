// ─────────────────────────────────────────────────────────────────────────────
// lib/data.ts — intentionally empty
//
// All data is loaded from Supabase via the API routes.
// Add records through the application UI; they persist in the database.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Deal,
  Proposal,
  Contract,
  Invoice,
  Project,
  MaintenanceRecord,
  Renewal,
  TeamMember,
  ActivityItem,
  RevenueMonth,
  CRMCompany,
  CRMContact,
  CRMActivity,
  AppTask,
  TimeEntry,
} from './types'

export const teamMembers:        TeamMember[]        = []
export const deals:              Deal[]              = []
export const proposals:          Proposal[]          = []
export const contracts:          Contract[]          = []
export const invoices:           Invoice[]           = []
export const projects:           Project[]           = []
export const maintenanceRecords: MaintenanceRecord[] = []
export const renewals:           Renewal[]           = []
export const activityFeed:       ActivityItem[]      = []
export const revenueByMonth:     RevenueMonth[]      = []
export const crmContacts:        CRMContact[]        = []
export const crmCompanies:       CRMCompany[]        = []
export const crmActivities:      CRMActivity[]       = []
export const appTasks:           AppTask[]           = []
export const timeEntries:        TimeEntry[]         = []

export const dashboardMetrics = {
  activeClients:    0,
  openDeals:        0,
  pipelineValue:    0,
  monthlyRevenue:   0,
  overdueInvoices:  0,
  upcomingRenewals: 0,
}
