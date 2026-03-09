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

export const teamMembers: TeamMember[] = [
  { id: 't0', name: 'Jonathan Graviss', email: 'jonathan@gravissmarketing.com', role: 'Super Admin', unit: 'Leadership/Admin', initials: 'JG' },
  { id: 't6', name: 'Amanda Foster', email: 'amanda@gravissmarketing.com', role: 'Leadership', unit: 'Leadership/Admin', initials: 'AF' },
  { id: 't1', name: 'Sarah Chen', email: 'sarah@gravissmarketing.com', role: 'Department Manager', unit: 'Sales', initials: 'SC' },
  { id: 't2', name: 'Marcus Webb', email: 'marcus@gravissmarketing.com', role: 'Team Member', unit: 'Sales', initials: 'MW' },
  { id: 't3', name: 'Jordan Ellis', email: 'jordan@gravissmarketing.com', role: 'Team Member', unit: 'Delivery/Operations', initials: 'JE' },
  { id: 't4', name: 'Priya Patel', email: 'priya@gravissmarketing.com', role: 'Department Manager', unit: 'Delivery/Operations', initials: 'PP' },
  { id: 't5', name: 'Tyler Ross', email: 'tyler@gravissmarketing.com', role: 'Team Member', unit: 'Billing/Finance', initials: 'TR' },
]

// ─── Trailhead Media ──────────────────────────────────────────────────────────

export const deals: Deal[] = [
  {
    id: 'deal_th',
    company: 'Trailhead Media, LLC',
    stage: 'Closed Won',
    value: 7800,
    serviceType: 'Website',
    closeDate: '2025-07-01',
    assignedRep: 'Jonathan Graviss',
    probability: 100,
    lastActivity: '2025-07-01',
    contact: { id: 'contact_th', name: 'Trailhead Media', email: '', phone: '', title: '' },
    notes: ['Custom website development and management — $650/month, 12-month agreement effective July 1, 2025'],
  },
]

export const proposals: Proposal[] = [
  {
    id: 'prop_th',
    dealId: 'deal_th',
    company: 'Trailhead Media, LLC',
    status: 'Accepted',
    value: 7800,
    serviceType: 'Website',
    createdDate: '2025-06-15',
    sentDate: '2025-06-15',
    viewedDate: '2025-06-16',
    respondedDate: '2025-06-20',
    assignedRep: 'Jonathan Graviss',
    items: [
      {
        id: 'item_th_1',
        description: 'Custom Website Development & Management — Monthly Retainer',
        type: 'recurring',
        quantity: 12,
        unitPrice: 650,
        total: 7800,
      },
    ],
    approvedBy: 'Jonathan Graviss',
    approvedDate: '2025-06-15',
  },
]

export const contracts: Contract[] = [
  {
    id: 'con_th',
    proposalId: 'prop_th',
    company: 'Trailhead Media, LLC',
    status: 'Fully Executed',
    value: 650,
    billingStructure: '$650/month',
    startDate: '2025-07-01',
    duration: 12,
    renewalDate: '2026-07-01',
    assignedRep: 'Jonathan Graviss',
    serviceType: 'Website',
    clientSigned: '2025-06-25',
    internalSigned: '2025-06-25',
  },
]

export const invoices: Invoice[] = [
  { id: 'inv_th_1',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2025-07-01', dueDate: '2025-07-01', paidDate: '2025-07-05',  serviceType: 'Website' },
  { id: 'inv_th_2',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2025-08-01', dueDate: '2025-08-01', paidDate: '2025-08-06',  serviceType: 'Website' },
  { id: 'inv_th_3',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2025-09-01', dueDate: '2025-09-01', paidDate: '2025-09-04',  serviceType: 'Website' },
  { id: 'inv_th_4',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2025-10-01', dueDate: '2025-10-01', paidDate: '2025-10-03',  serviceType: 'Website' },
  { id: 'inv_th_5',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2025-11-01', dueDate: '2025-11-01', paidDate: '2025-11-07',  serviceType: 'Website' },
  { id: 'inv_th_6',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2025-12-01', dueDate: '2025-12-01', paidDate: '2025-12-05',  serviceType: 'Website' },
  { id: 'inv_th_7',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2026-01-01', dueDate: '2026-01-01', paidDate: '2026-01-06',  serviceType: 'Website' },
  { id: 'inv_th_8',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Paid',   issuedDate: '2026-02-01', dueDate: '2026-02-01', paidDate: '2026-02-04',  serviceType: 'Website' },
  { id: 'inv_th_9',  contractId: 'con_th', company: 'Trailhead Media, LLC', amount: 650, status: 'Sent',   issuedDate: '2026-03-01', dueDate: '2026-03-01',                          serviceType: 'Website' },
]

export const projects: Project[] = [
  {
    id: 'proj_th',
    contractId: 'con_th',
    company: 'Trailhead Media, LLC',
    serviceType: 'Website',
    status: 'In Maintenance',
    startDate: '2025-07-01',
    launchDate: '2025-07-01',
    maintenanceStartDate: '2025-07-01',
    assignedTeam: ['Jonathan Graviss'],
    progress: 100,
    milestones: [
      { id: 'ms_th_1', name: 'Initial Setup & Launch', dueDate: '2025-07-01', completed: true },
      { id: 'ms_th_2', name: 'Ongoing Maintenance Active', dueDate: '2025-07-01', completed: true },
    ],
    tasks: [],
  },
]

export const maintenanceRecords: MaintenanceRecord[] = [
  {
    id: 'mr_th',
    company: 'Trailhead Media, LLC',
    serviceType: 'Website',
    startDate: '2025-07-01',
    monthlyFee: 650,
    contractDuration: 12,
    cancellationWindow: 30,
    status: 'Active',
    nextBillingDate: '2026-04-01',
  },
]

export const renewals: Renewal[] = [
  {
    id: 'ren_th',
    company: 'Trailhead Media, LLC',
    contractId: 'con_th',
    expirationDate: '2026-06-30',
    renewalValue: 650,
    assignedRep: 'Jonathan Graviss',
    status: 'Upcoming',
    daysUntilExpiry: 113,
    serviceType: 'Website',
  },
]

export const activityFeed: ActivityItem[] = [
  { id: 'act_th_1', type: 'contract', description: 'Service Agreement fully executed — $650/month', company: 'Trailhead Media, LLC', timestamp: '2025-07-01', user: 'Jonathan Graviss' },
  { id: 'act_th_2', type: 'invoice',  description: 'Invoice paid — $650 (July 2025)',              company: 'Trailhead Media, LLC', timestamp: '2025-07-05', user: 'Jonathan Graviss' },
  { id: 'act_th_3', type: 'invoice',  description: 'Invoice paid — $650 (March 2026)',              company: 'Trailhead Media, LLC', timestamp: '2026-03-01', user: 'Jonathan Graviss' },
]

export const revenueByMonth: RevenueMonth[] = [
  { month: 'Jul 2025', revenue: 650, recurring: 650 },
  { month: 'Aug 2025', revenue: 650, recurring: 650 },
  { month: 'Sep 2025', revenue: 650, recurring: 650 },
  { month: 'Oct 2025', revenue: 650, recurring: 650 },
  { month: 'Nov 2025', revenue: 650, recurring: 650 },
  { month: 'Dec 2025', revenue: 650, recurring: 650 },
  { month: 'Jan 2026', revenue: 650, recurring: 650 },
  { month: 'Feb 2026', revenue: 650, recurring: 650 },
  { month: 'Mar 2026', revenue: 650, recurring: 650 },
]

// ─── CRM ──────────────────────────────────────────────────────────────────────

export const crmContacts: CRMContact[] = [
  {
    id: 'contact_th',
    companyId: 'comp_th',
    companyName: 'Trailhead Media, LLC',
    firstName: 'Trailhead',
    lastName: 'Media',
    fullName: 'Trailhead Media',
    title: 'Client',
    email: '',
    phone: '',
    isPrimary: true,
    owner: 'Jonathan Graviss',
    tags: ['Signed Client', 'Website'],
    contactNotes: [],
    contactTasks: [],
    createdDate: '2025-07-01',
    lastActivity: '2026-03-01',
  },
]

export const crmCompanies: CRMCompany[] = [
  {
    id: 'comp_th',
    name: 'Trailhead Media, LLC',
    industry: 'Media & Communications',
    website: '',
    phone: '',
    hq: '',
    size: '1-10',
    annualRevenue: 7800,
    status: 'Active Client',
    owner: 'Jonathan Graviss',
    description: 'Digital marketing services client. Custom website development and management under 12-month service agreement effective July 1, 2025.',
    tags: ['Signed Client', 'Website'],
    contactIds: ['contact_th'],
    dealIds: ['deal_th'],
    createdDate: '2025-07-01',
    lastActivity: '2026-03-01',
    totalDealValue: 7800,
  },
]

export const crmActivities: CRMActivity[] = [
  {
    id: 'crmact_th_1',
    type: 'contract',
    title: 'Service Agreement Executed',
    body: 'Graviss Marketing – Trailhead Media Service Agreement fully executed. $650/month for 12 months beginning July 1, 2025.',
    companyId: 'comp_th',
    companyName: 'Trailhead Media, LLC',
    contactId: 'contact_th',
    user: 'Jonathan Graviss',
    timestamp: '2025-06-25',
    pinned: true,
  },
  {
    id: 'crmact_th_2',
    type: 'note',
    title: 'Contract Terms',
    body: 'Monthly fee: $650 due on the first business day of each month. Early termination penalty: $1,950 (3 months). Governing law: Florida. Services include custom website development, unlimited edits, SSL, hosting, SEO-friendly content, and lead form implementation.',
    companyId: 'comp_th',
    companyName: 'Trailhead Media, LLC',
    contactId: 'contact_th',
    user: 'Jonathan Graviss',
    timestamp: '2025-07-01',
    pinned: true,
  },
]

export const dashboardMetrics = {
  mrr: 650,
  activeClients: 1,
  openDeals: 0,
  openInvoices: 1,
  overdueInvoices: 0,
  upcomingRenewals: 1,
  pipelineValue: 0,
  bookedRevenue: 5850,
  revenueCollected: 5200,
  activeProjects: 1,
}

export const appTasks: AppTask[] = []

export const timeEntries: TimeEntry[] = []
