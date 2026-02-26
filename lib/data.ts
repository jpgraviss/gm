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
} from './types'

export const teamMembers: TeamMember[] = [
  { id: 't1', name: 'Sarah Chen', email: 'sarah@gravissmarketing.com', role: 'Department Manager', unit: 'Sales', initials: 'SC' },
  { id: 't2', name: 'Marcus Webb', email: 'marcus@gravissmarketing.com', role: 'Team Member', unit: 'Sales', initials: 'MW' },
  { id: 't3', name: 'Jordan Ellis', email: 'jordan@gravissmarketing.com', role: 'Team Member', unit: 'Delivery/Operations', initials: 'JE' },
  { id: 't4', name: 'Priya Patel', email: 'priya@gravissmarketing.com', role: 'Department Manager', unit: 'Delivery/Operations', initials: 'PP' },
  { id: 't5', name: 'Tyler Ross', email: 'tyler@gravissmarketing.com', role: 'Team Member', unit: 'Billing/Finance', initials: 'TR' },
  { id: 't6', name: 'Amanda Foster', email: 'amanda@gravissmarketing.com', role: 'Leadership', unit: 'Leadership/Admin', initials: 'AF' },
]

export const deals: Deal[] = [
  {
    id: 'd1', company: 'Apex Solutions', stage: 'Proposal Sent', value: 18500, serviceType: 'Website',
    closeDate: '2026-03-15', assignedRep: 'Sarah Chen', probability: 65, lastActivity: '2 hours ago',
    contact: { id: 'c1', name: 'Marcus Rivera', email: 'marcus@apex.com', phone: '555-0101', title: 'CEO' },
    notes: ['Budget approved Q1', 'Needs full redesign with e-commerce'],
  },
  {
    id: 'd2', company: 'BlueStar Logistics', stage: 'Contract Sent', value: 32000, serviceType: 'SEO',
    closeDate: '2026-02-28', assignedRep: 'Marcus Webb', probability: 85, lastActivity: '1 day ago',
    contact: { id: 'c2', name: 'Kelly Shaw', email: 'kelly@bluestar.com', phone: '555-0202', title: 'VP Marketing' },
    notes: ['Ready to sign', 'Wants 12-month commitment'],
  },
  {
    id: 'd3', company: 'Meridian Healthcare', stage: 'Qualified', value: 45000, serviceType: 'Branding',
    closeDate: '2026-04-01', assignedRep: 'Sarah Chen', probability: 40, lastActivity: '3 days ago',
    contact: { id: 'c3', name: 'Dr. Nina Okafor', email: 'nina@meridian.com', phone: '555-0303', title: 'CMO' },
    notes: ['Strong interest', 'Competing with 2 other agencies'],
  },
  {
    id: 'd4', company: 'TechFlow Inc', stage: 'Lead', value: 9800, serviceType: 'Social Media',
    closeDate: '2026-04-15', assignedRep: 'Marcus Webb', probability: 20, lastActivity: '1 week ago',
    contact: { id: 'c4', name: 'Sam Torres', email: 'sam@techflow.com', phone: '555-0404', title: 'Founder' },
    notes: ['Intro call done', 'Follow up scheduled'],
  },
  {
    id: 'd5', company: 'Coastal Realty', stage: 'Closed Won', value: 27500, serviceType: 'Website',
    closeDate: '2026-02-10', assignedRep: 'Sarah Chen', probability: 100, lastActivity: '5 days ago',
    contact: { id: 'c5', name: 'Dana Kim', email: 'dana@coastalrealty.com', phone: '555-0505', title: 'Owner' },
    notes: ['Contract signed', 'Project kick-off Feb 20'],
  },
  {
    id: 'd6', company: 'Harvest Foods', stage: 'Closed Won', value: 14200, serviceType: 'Email Marketing',
    closeDate: '2026-02-05', assignedRep: 'Marcus Webb', probability: 100, lastActivity: '2 weeks ago',
    contact: { id: 'c6', name: 'Frank Lopez', email: 'frank@harvestfoods.com', phone: '555-0606', title: 'Marketing Dir.' },
    notes: ['Long-term client', 'Upsell opportunity for SEO'],
  },
  {
    id: 'd7', company: 'Summit Capital', stage: 'Proposal Sent', value: 52000, serviceType: 'Custom',
    closeDate: '2026-03-30', assignedRep: 'Sarah Chen', probability: 55, lastActivity: '4 days ago',
    contact: { id: 'c7', name: 'Robert Ng', email: 'robert@summitcap.com', phone: '555-0707', title: 'CTO' },
    notes: ['Custom platform build + marketing stack'],
  },
  {
    id: 'd8', company: 'GreenLeaf Organics', stage: 'Qualified', value: 11000, serviceType: 'Social Media',
    closeDate: '2026-03-20', assignedRep: 'Marcus Webb', probability: 50, lastActivity: '6 days ago',
    contact: { id: 'c8', name: 'Olivia Grant', email: 'olivia@greenleaf.com', phone: '555-0808', title: 'CMO' },
    notes: ['Instagram-focused campaign'],
  },
]

export const proposals: Proposal[] = [
  {
    id: 'p1', dealId: 'd1', company: 'Apex Solutions', status: 'Sent', value: 18500,
    serviceType: 'Website', createdDate: '2026-02-18', sentDate: '2026-02-20', assignedRep: 'Sarah Chen',
    items: [
      { id: 'pi1', description: 'Website Design & Development', type: 'one-time', quantity: 1, unitPrice: 15000, total: 15000 },
      { id: 'pi2', description: 'Monthly Maintenance', type: 'recurring', quantity: 1, unitPrice: 500, total: 500 },
      { id: 'pi3', description: 'SEO Setup', type: 'one-time', quantity: 1, unitPrice: 3000, total: 3000 },
    ],
  },
  {
    id: 'p2', dealId: 'd2', company: 'BlueStar Logistics', status: 'Accepted', value: 32000,
    serviceType: 'SEO', createdDate: '2026-02-10', sentDate: '2026-02-12', viewedDate: '2026-02-13',
    respondedDate: '2026-02-15', assignedRep: 'Marcus Webb',
    items: [
      { id: 'pi4', description: 'SEO Strategy & Implementation', type: 'one-time', quantity: 1, unitPrice: 8000, total: 8000 },
      { id: 'pi5', description: 'Monthly SEO Management', type: 'recurring', quantity: 12, unitPrice: 2000, total: 24000 },
    ],
  },
  {
    id: 'p3', dealId: 'd7', company: 'Summit Capital', status: 'Viewed', value: 52000,
    serviceType: 'Custom', createdDate: '2026-02-22', sentDate: '2026-02-23', viewedDate: '2026-02-24',
    assignedRep: 'Sarah Chen',
    items: [
      { id: 'pi6', description: 'Custom Platform Development', type: 'one-time', quantity: 1, unitPrice: 42000, total: 42000 },
      { id: 'pi7', description: 'Monthly Retainer', type: 'recurring', quantity: 12, unitPrice: 833, total: 10000 },
    ],
  },
  {
    id: 'p4', dealId: 'd5', company: 'Coastal Realty', status: 'Accepted', value: 27500,
    serviceType: 'Website', createdDate: '2026-02-01', sentDate: '2026-02-03', viewedDate: '2026-02-04',
    respondedDate: '2026-02-07', assignedRep: 'Sarah Chen',
    items: [
      { id: 'pi8', description: 'Custom Real Estate Website', type: 'one-time', quantity: 1, unitPrice: 22500, total: 22500 },
      { id: 'pi9', description: 'Monthly Hosting & Maintenance', type: 'recurring', quantity: 12, unitPrice: 417, total: 5000 },
    ],
  },
  {
    id: 'p5', dealId: 'd3', company: 'Meridian Healthcare', status: 'Draft', value: 45000,
    serviceType: 'Branding', createdDate: '2026-02-25', assignedRep: 'Sarah Chen',
    items: [
      { id: 'pi10', description: 'Full Brand Identity System', type: 'one-time', quantity: 1, unitPrice: 38000, total: 38000 },
      { id: 'pi11', description: 'Brand Guidelines & Collateral', type: 'one-time', quantity: 1, unitPrice: 7000, total: 7000 },
    ],
  },
]

export const contracts: Contract[] = [
  {
    id: 'con1', proposalId: 'p2', company: 'BlueStar Logistics', status: 'Fully Executed', value: 32000,
    billingStructure: '$8,000 upfront + $2,000/mo', startDate: '2026-02-20', duration: 12,
    renewalDate: '2027-02-20', assignedRep: 'Marcus Webb', serviceType: 'SEO',
    clientSigned: '2026-02-18', internalSigned: '2026-02-18',
  },
  {
    id: 'con2', proposalId: 'p4', company: 'Coastal Realty', status: 'Fully Executed', value: 27500,
    billingStructure: '$22,500 upfront + $417/mo', startDate: '2026-02-15', duration: 12,
    renewalDate: '2027-02-15', assignedRep: 'Sarah Chen', serviceType: 'Website',
    clientSigned: '2026-02-10', internalSigned: '2026-02-10',
  },
  {
    id: 'con3', company: 'Harvest Foods', status: 'Fully Executed', value: 14200,
    billingStructure: '$2,200 setup + $1,000/mo', startDate: '2026-01-15', duration: 12,
    renewalDate: '2027-01-15', assignedRep: 'Marcus Webb', serviceType: 'Email Marketing',
    clientSigned: '2026-01-14', internalSigned: '2026-01-14',
  },
  {
    id: 'con4', proposalId: 'p1', company: 'Apex Solutions', status: 'Sent', value: 18500,
    billingStructure: '$15,000 upfront + $500/mo', startDate: '2026-03-01', duration: 12,
    renewalDate: '2027-03-01', assignedRep: 'Sarah Chen', serviceType: 'Website',
  },
  {
    id: 'con5', proposalId: 'p3', company: 'Summit Capital', status: 'Draft', value: 52000,
    billingStructure: '$42,000 upfront + $833/mo', startDate: '2026-04-01', duration: 12,
    renewalDate: '2027-04-01', assignedRep: 'Sarah Chen', serviceType: 'Custom',
  },
  {
    id: 'con6', company: 'Pinnacle Group', status: 'Countersign Needed', value: 19800,
    billingStructure: '$1,650/mo', startDate: '2026-03-01', duration: 12,
    renewalDate: '2027-03-01', assignedRep: 'Marcus Webb', serviceType: 'SEO',
    clientSigned: '2026-02-25',
  },
]

export const invoices: Invoice[] = [
  { id: 'inv1', contractId: 'con1', company: 'BlueStar Logistics', amount: 8000, status: 'Paid', issuedDate: '2026-02-20', dueDate: '2026-02-27', paidDate: '2026-02-24', serviceType: 'SEO' },
  { id: 'inv2', contractId: 'con2', company: 'Coastal Realty', amount: 22500, status: 'Paid', issuedDate: '2026-02-15', dueDate: '2026-02-22', paidDate: '2026-02-19', serviceType: 'Website' },
  { id: 'inv3', contractId: 'con3', company: 'Harvest Foods', amount: 2200, status: 'Paid', issuedDate: '2026-01-15', dueDate: '2026-01-22', paidDate: '2026-01-20', serviceType: 'Email Marketing' },
  { id: 'inv4', contractId: 'con3', company: 'Harvest Foods', amount: 1000, status: 'Paid', issuedDate: '2026-02-15', dueDate: '2026-02-22', paidDate: '2026-02-21', serviceType: 'Email Marketing' },
  { id: 'inv5', contractId: 'con1', company: 'BlueStar Logistics', amount: 2000, status: 'Sent', issuedDate: '2026-02-20', dueDate: '2026-03-07', serviceType: 'SEO' },
  { id: 'inv6', contractId: 'con2', company: 'Coastal Realty', amount: 417, status: 'Pending', issuedDate: '2026-03-01', dueDate: '2026-03-08', serviceType: 'Website' },
  { id: 'inv7', contractId: 'con3', company: 'Harvest Foods', amount: 1000, status: 'Overdue', issuedDate: '2026-01-30', dueDate: '2026-02-06', serviceType: 'Email Marketing' },
]

export const projects: Project[] = [
  {
    id: 'pr1', contractId: 'con2', company: 'Coastal Realty', serviceType: 'Website', status: 'In Progress',
    startDate: '2026-02-20', launchDate: '2026-04-15', assignedTeam: ['Jordan Ellis', 'Priya Patel'], progress: 35,
    milestones: [
      { id: 'm1', name: 'Discovery & Strategy', dueDate: '2026-02-28', completed: true },
      { id: 'm2', name: 'Wireframes Approved', dueDate: '2026-03-10', completed: false },
      { id: 'm3', name: 'Design Mockups', dueDate: '2026-03-25', completed: false },
      { id: 'm4', name: 'Development Complete', dueDate: '2026-04-08', completed: false },
      { id: 'm5', name: 'Client Review & Launch', dueDate: '2026-04-15', completed: false },
    ],
    tasks: [
      { id: 'tk1', title: 'Gather brand assets from client', assignee: 'Jordan Ellis', dueDate: '2026-02-26', completed: true, priority: 'High' },
      { id: 'tk2', title: 'Create sitemap', assignee: 'Priya Patel', dueDate: '2026-02-28', completed: true, priority: 'High' },
      { id: 'tk3', title: 'Design homepage wireframe', assignee: 'Jordan Ellis', dueDate: '2026-03-05', completed: false, priority: 'High' },
      { id: 'tk4', title: 'Set up WordPress staging environment', assignee: 'Priya Patel', dueDate: '2026-03-01', completed: false, priority: 'Medium' },
    ],
  },
  {
    id: 'pr2', contractId: 'con1', company: 'BlueStar Logistics', serviceType: 'SEO', status: 'In Progress',
    startDate: '2026-02-21', launchDate: '2026-03-07', assignedTeam: ['Priya Patel'], progress: 60,
    milestones: [
      { id: 'm6', name: 'Technical SEO Audit', dueDate: '2026-02-27', completed: true },
      { id: 'm7', name: 'Keyword Strategy Approved', dueDate: '2026-03-02', completed: false },
      { id: 'm8', name: 'On-Page Optimization', dueDate: '2026-03-07', completed: false },
    ],
    tasks: [
      { id: 'tk5', title: 'Complete site crawl report', assignee: 'Priya Patel', dueDate: '2026-02-25', completed: true, priority: 'High' },
      { id: 'tk6', title: 'Competitor keyword analysis', assignee: 'Priya Patel', dueDate: '2026-02-28', completed: false, priority: 'High' },
    ],
  },
  {
    id: 'pr3', contractId: 'con3', company: 'Harvest Foods', serviceType: 'Email Marketing', status: 'In Maintenance',
    startDate: '2026-01-20', launchDate: '2026-02-01', maintenanceStartDate: '2026-02-01',
    assignedTeam: ['Jordan Ellis'], progress: 100,
    milestones: [
      { id: 'm9', name: 'List Segmentation', dueDate: '2026-01-25', completed: true },
      { id: 'm10', name: 'Template Design', dueDate: '2026-01-28', completed: true },
      { id: 'm11', name: 'First Campaign Sent', dueDate: '2026-02-01', completed: true },
    ],
    tasks: [],
  },
]

export const maintenanceRecords: MaintenanceRecord[] = [
  { id: 'mr1', company: 'Harvest Foods', serviceType: 'Email Marketing', startDate: '2026-02-01', monthlyFee: 1000, contractDuration: 12, cancellationWindow: 30, status: 'Active', nextBillingDate: '2026-03-15' },
  { id: 'mr2', company: 'Coastal Realty', serviceType: 'Website', startDate: '2026-04-15', monthlyFee: 417, contractDuration: 12, cancellationWindow: 30, status: 'Active', nextBillingDate: '2026-05-15' },
  { id: 'mr3', company: 'BlueStar Logistics', serviceType: 'SEO', startDate: '2026-03-07', monthlyFee: 2000, contractDuration: 12, cancellationWindow: 60, status: 'Active', nextBillingDate: '2026-03-07' },
  { id: 'mr4', company: 'ProVenture LLC', serviceType: 'Website', startDate: '2025-03-01', monthlyFee: 350, contractDuration: 12, cancellationWindow: 30, status: 'Pending Cancellation', nextBillingDate: '2026-03-01' },
]

export const renewals: Renewal[] = [
  { id: 'r1', company: 'ProVenture LLC', contractId: 'con-old1', expirationDate: '2026-03-01', renewalValue: 4200, assignedRep: 'Sarah Chen', status: 'In Progress', daysUntilExpiry: 3, serviceType: 'Website' },
  { id: 'r2', company: 'Harvest Foods', contractId: 'con3', expirationDate: '2027-01-15', renewalValue: 14200, assignedRep: 'Marcus Webb', status: 'Upcoming', daysUntilExpiry: 323, serviceType: 'Email Marketing' },
  { id: 'r3', company: 'NovaBuild Corp', contractId: 'con-old2', expirationDate: '2026-04-10', renewalValue: 28000, assignedRep: 'Sarah Chen', status: 'Upcoming', daysUntilExpiry: 43, serviceType: 'SEO' },
  { id: 'r4', company: 'ClearPath Media', contractId: 'con-old3', expirationDate: '2026-05-01', renewalValue: 9600, assignedRep: 'Marcus Webb', status: 'Upcoming', daysUntilExpiry: 64, serviceType: 'Social Media' },
  { id: 'r5', company: 'Forge Industries', contractId: 'con-old4', expirationDate: '2026-03-20', renewalValue: 18500, assignedRep: 'Sarah Chen', status: 'In Progress', daysUntilExpiry: 22, serviceType: 'Website' },
]

export const activityFeed: ActivityItem[] = [
  { id: 'a1', type: 'contract', description: 'Contract fully executed', company: 'BlueStar Logistics', timestamp: '2 hours ago', user: 'Marcus Webb' },
  { id: 'a2', type: 'invoice', description: 'Invoice #INV-002 paid — $22,500', company: 'Coastal Realty', timestamp: '3 hours ago', user: 'Tyler Ross' },
  { id: 'a3', type: 'proposal', description: 'Proposal viewed by client', company: 'Summit Capital', timestamp: '5 hours ago', user: 'System' },
  { id: 'a4', type: 'deal', description: 'Deal advanced to Contract Sent', company: 'BlueStar Logistics', timestamp: '1 day ago', user: 'Marcus Webb' },
  { id: 'a5', type: 'project', description: 'Milestone "Discovery & Strategy" completed', company: 'Coastal Realty', timestamp: '1 day ago', user: 'Jordan Ellis' },
  { id: 'a6', type: 'proposal', description: 'Proposal accepted — $27,500', company: 'Coastal Realty', timestamp: '2 days ago', user: 'Sarah Chen' },
  { id: 'a7', type: 'deal', description: 'New lead created', company: 'TechFlow Inc', timestamp: '3 days ago', user: 'Marcus Webb' },
]

export const revenueByMonth: RevenueMonth[] = [
  { month: 'Sep', revenue: 28000, recurring: 8500 },
  { month: 'Oct', revenue: 34000, recurring: 9200 },
  { month: 'Nov', revenue: 22000, recurring: 9800 },
  { month: 'Dec', revenue: 41000, recurring: 10400 },
  { month: 'Jan', revenue: 38500, recurring: 11000 },
  { month: 'Feb', revenue: 56700, recurring: 12000 },
]

// Computed metrics
export const dashboardMetrics = {
  pipelineValue: deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0),
  bookedRevenue: contracts.filter(c => c.status === 'Fully Executed').reduce((s, c) => s + c.value, 0),
  revenueCollected: invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
  mrr: maintenanceRecords.filter(m => m.status === 'Active').reduce((s, m) => s + m.monthlyFee, 0),
  activeProjects: projects.filter(p => ['In Progress', 'Awaiting Client', 'Not Started'].includes(p.status)).length,
  upcomingRenewals: renewals.filter(r => r.daysUntilExpiry <= 90 && r.status !== 'Renewed').length,
}
