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
  {
    id: 'pr4', contractId: 'con4', company: 'Apex Solutions', serviceType: 'Website', status: 'Not Started',
    startDate: '2026-03-01', launchDate: '2026-05-15', assignedTeam: ['Jordan Ellis', 'Priya Patel'], progress: 0,
    milestones: [
      { id: 'm14', name: 'Kickoff Meeting', dueDate: '2026-03-05', completed: false },
      { id: 'm15', name: 'Brand Discovery', dueDate: '2026-03-20', completed: false },
      { id: 'm16', name: 'Wireframes Approved', dueDate: '2026-04-05', completed: false },
      { id: 'm17', name: 'Design & Development', dueDate: '2026-04-30', completed: false },
      { id: 'm18', name: 'Launch', dueDate: '2026-05-15', completed: false },
    ],
    tasks: [
      { id: 'tk10', title: 'Schedule kickoff call with Marcus Rivera', assignee: 'Jordan Ellis', dueDate: '2026-02-28', completed: false, priority: 'High' },
      { id: 'tk11', title: 'Prepare project brief document', assignee: 'Priya Patel', dueDate: '2026-03-01', completed: false, priority: 'Medium' },
      { id: 'tk12', title: 'Set up project in tracking system', assignee: 'Priya Patel', dueDate: '2026-03-02', completed: false, priority: 'Low' },
    ],
  },
  {
    id: 'pr5', contractId: '', company: 'GreenLeaf Organics', serviceType: 'Social Media', status: 'Awaiting Client',
    startDate: '2026-02-15', launchDate: '2026-03-15', assignedTeam: ['Jordan Ellis'], progress: 45,
    milestones: [
      { id: 'm19', name: 'Account Audit', dueDate: '2026-02-20', completed: true },
      { id: 'm20', name: 'Strategy Approved', dueDate: '2026-02-28', completed: false },
      { id: 'm21', name: 'Content Calendar Live', dueDate: '2026-03-07', completed: false },
      { id: 'm22', name: 'First Month Report', dueDate: '2026-03-15', completed: false },
    ],
    tasks: [
      { id: 'tk13', title: 'Send strategy deck for client approval', assignee: 'Jordan Ellis', dueDate: '2026-02-25', completed: false, priority: 'High' },
      { id: 'tk14', title: 'Create 30-day content calendar', assignee: 'Jordan Ellis', dueDate: '2026-03-01', completed: false, priority: 'High' },
      { id: 'tk15', title: 'Set up Buffer scheduling tool', assignee: 'Jordan Ellis', dueDate: '2026-02-28', completed: true, priority: 'Medium' },
    ],
  },
  {
    id: 'pr6', contractId: 'con-old2', company: 'NovaBuild Corp', serviceType: 'SEO', status: 'In Maintenance',
    startDate: '2025-04-15', launchDate: '2025-07-01', maintenanceStartDate: '2025-07-01',
    assignedTeam: ['Priya Patel'], progress: 100,
    milestones: [
      { id: 'm23', name: 'Technical SEO Audit', dueDate: '2025-04-30', completed: true },
      { id: 'm24', name: 'On-Page Optimization', dueDate: '2025-05-31', completed: true },
      { id: 'm25', name: 'Link Building Campaign', dueDate: '2025-06-15', completed: true },
      { id: 'm26', name: 'Monthly Reporting Live', dueDate: '2025-07-01', completed: true },
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

// ─── Full CRM Data ──────────────────────────────────────────────────────────

export const crmContacts: CRMContact[] = [
  {
    id: 'cc1', companyId: 'comp1', companyName: 'Apex Solutions',
    firstName: 'Marcus', lastName: 'Rivera', fullName: 'Marcus Rivera',
    title: 'CEO', email: 'marcus@apex.com', phone: '555-0101',
    website: 'apexsolutions.com',
    isPrimary: true, owner: 'Sarah Chen', tags: ['Decision Maker', 'Executive'],
    createdDate: '2026-01-15', lastActivity: '2 days ago',
    contactNotes: [
      { id: 'cn1a', body: 'Discovery call went really well. Marcus confirmed $15K budget for site redesign. Very enthusiastic about e-commerce functionality. He mentioned they\'ve worked with 2 other agencies before and were disappointed with results. We need to differentiate on deliverables and communication.', date: '2026-02-24', author: 'Sarah Chen' },
      { id: 'cn1b', body: 'Follow-up on proposal. Marcus says he\'s sharing with the board before making a final decision. Asked if we could add a phase breakdown so the board can see incremental milestones. Will update proposal and resend by EOD.', date: '2026-02-26', author: 'Sarah Chen' },
    ],
    contactTasks: [
      { id: 'ct1a', title: 'Send updated proposal with phase breakdown', taskType: 'proposal', dueDate: '2026-02-28', completed: false, priority: 'high', assignedTo: 'Sarah Chen', notes: 'Marcus asked for milestone-based breakdown for board review' },
      { id: 'ct1b', title: 'Follow up if no response by March 3', taskType: 'follow_up', dueDate: '2026-03-03', completed: false, priority: 'medium', assignedTo: 'Sarah Chen' },
    ],
  },
  {
    id: 'cc2', companyId: 'comp1', companyName: 'Apex Solutions',
    firstName: 'Lisa', lastName: 'Park', fullName: 'Lisa Park',
    title: 'Marketing Director', email: 'lisa@apex.com', phone: '555-0102',
    website: 'apexsolutions.com',
    isPrimary: false, owner: 'Sarah Chen', tags: ['Marketing'],
    createdDate: '2026-01-20', lastActivity: '1 week ago',
  },
  {
    id: 'cc3', companyId: 'comp2', companyName: 'BlueStar Logistics',
    firstName: 'Kelly', lastName: 'Shaw', fullName: 'Kelly Shaw',
    title: 'VP Marketing', email: 'kelly@bluestar.com', phone: '555-0202',
    website: 'bluestarlogistics.com',
    isPrimary: true, owner: 'Marcus Webb', tags: ['Decision Maker', 'Signed Client'],
    createdDate: '2025-11-10', lastActivity: '1 day ago',
    contactNotes: [
      { id: 'cn3a', body: 'Contract meeting at BlueStar HQ. Kelly was great — very clear on what she wants. Primary concern is brand consistency across all deliverables. She wants bi-weekly check-ins via Zoom, not just status emails. Very detail-oriented person.', date: '2026-02-17', author: 'Marcus Webb' },
      { id: 'cn3b', body: 'SEO campaign kickoff notes (from Granola): Discussed target keyword clusters, competitor gap analysis plan, and content calendar structure. Kelly approved 10 pillar pages as foundation. She also mentioned a trade show in April where updated site needs to be live.', date: '2026-02-25', author: 'Marcus Webb' },
    ],
    contactTasks: [
      { id: 'ct3a', title: 'Schedule bi-weekly Zoom — first one by March 5', taskType: 'meeting', dueDate: '2026-03-01', completed: false, priority: 'high', assignedTo: 'Marcus Webb', notes: 'Kelly prefers Tuesdays or Thursdays at 10am CST' },
      { id: 'ct3b', title: 'Send onboarding checklist and brand intake form', taskType: 'email', dueDate: '2026-02-28', completed: true, priority: 'medium', assignedTo: 'Marcus Webb' },
    ],
  },
  {
    id: 'cc4', companyId: 'comp2', companyName: 'BlueStar Logistics',
    firstName: 'Tom', lastName: 'Briggs', fullName: 'Tom Briggs',
    title: 'CEO', email: 'tom@bluestar.com', phone: '555-0203',
    isPrimary: false, owner: 'Marcus Webb', tags: ['Executive', 'Decision Maker'],
    createdDate: '2025-11-10', lastActivity: '2 weeks ago',
  },
  {
    id: 'cc5', companyId: 'comp3', companyName: 'Meridian Healthcare',
    firstName: 'Dr. Nina', lastName: 'Okafor', fullName: 'Dr. Nina Okafor',
    title: 'Chief Marketing Officer', email: 'nina@meridian.com', phone: '555-0303',
    website: 'meridianhc.com',
    isPrimary: true, owner: 'Sarah Chen', tags: ['Warm Lead', 'Healthcare'],
    createdDate: '2026-01-28', lastActivity: '3 days ago',
    contactNotes: [
      { id: 'cn5a', body: 'Cold outreach call — Dr. Okafor was very receptive. She mentioned they\'ve been unhappy with their current branding which looks "dated and clinical." She wants the brand to feel modern and approachable. They\'re interviewing 3 agencies. Key differentiator we should lean into: our healthcare case studies.', date: '2026-02-22', author: 'Sarah Chen' },
    ],
    contactTasks: [
      { id: 'ct5a', title: 'Send healthcare credentials deck + 2 case studies', taskType: 'email', dueDate: '2026-02-28', completed: false, priority: 'high', assignedTo: 'Sarah Chen', notes: 'Nina asked specifically for healthcare brand work examples' },
      { id: 'ct5b', title: 'Schedule follow-up discovery call', taskType: 'call', dueDate: '2026-03-05', completed: false, priority: 'high', assignedTo: 'Sarah Chen' },
    ],
  },
  {
    id: 'cc6', companyId: 'comp4', companyName: 'TechFlow Inc',
    firstName: 'Sam', lastName: 'Torres', fullName: 'Sam Torres',
    title: 'Founder & CEO', email: 'sam@techflow.com', phone: '555-0404',
    website: 'techflowinc.com',
    isPrimary: true, owner: 'Marcus Webb', tags: ['Startup', 'New Lead'],
    createdDate: '2026-02-10', lastActivity: '1 week ago',
    contactTasks: [
      { id: 'ct6a', title: 'Third follow-up — try different approach', taskType: 'follow_up', dueDate: '2026-03-01', completed: false, priority: 'medium', assignedTo: 'Marcus Webb', notes: 'No response to 2 emails. Try LinkedIn DM or call.' },
    ],
  },
  {
    id: 'cc7', companyId: 'comp5', companyName: 'Coastal Realty',
    firstName: 'Dana', lastName: 'Kim', fullName: 'Dana Kim',
    title: 'Owner', email: 'dana@coastalrealty.com', phone: '555-0505',
    website: 'coastalrealty.com',
    isPrimary: true, owner: 'Sarah Chen', tags: ['Active Client', 'Real Estate'],
    createdDate: '2025-10-05', lastActivity: 'Today',
    contactNotes: [
      { id: 'cn7a', body: 'Project kick-off — Dana is very engaged and excited. She wants to be involved in every major design decision. Prefers to communicate via text for quick questions and email for formal updates. Stressed that the site must look "luxury" — competing against high-end coastal brokerages.', date: '2026-02-20', author: 'Jordan Ellis' },
    ],
    contactTasks: [
      { id: 'ct7a', title: 'Deliver wireframes for review', taskType: 'other', dueDate: '2026-03-05', completed: false, priority: 'high', assignedTo: 'Jordan Ellis', notes: 'Homepage + Property Listing page wireframes' },
      { id: 'ct7b', title: 'Weekly check-in call — every Tuesday', taskType: 'call', dueDate: '2026-03-04', completed: false, priority: 'medium', assignedTo: 'Sarah Chen' },
    ],
  },
  {
    id: 'cc8', companyId: 'comp6', companyName: 'Harvest Foods',
    firstName: 'Frank', lastName: 'Lopez', fullName: 'Frank Lopez',
    title: 'Marketing Director', email: 'frank@harvestfoods.com', phone: '555-0606',
    website: 'harvestfoods.com',
    isPrimary: true, owner: 'Marcus Webb', tags: ['Active Client', 'Upsell Opportunity'],
    createdDate: '2025-09-15', lastActivity: '3 days ago',
    contactNotes: [
      { id: 'cn8a', body: 'Monthly check-in. Email open rates up 22% — Frank is thrilled. He casually mentioned they\'ve been thinking about SEO but "don\'t know where to start." This is a clear upsell opportunity. Need to put together a brief SEO pitch deck tailored to F&B.', date: '2026-02-23', author: 'Marcus Webb' },
    ],
    contactTasks: [
      { id: 'ct8a', title: 'Prepare SEO upsell deck for Harvest Foods', taskType: 'proposal', dueDate: '2026-03-07', completed: false, priority: 'medium', assignedTo: 'Marcus Webb', notes: 'Focus on local SEO and Google Business Profile for food brands' },
    ],
  },
  {
    id: 'cc9', companyId: 'comp7', companyName: 'Summit Capital',
    firstName: 'Robert', lastName: 'Ng', fullName: 'Robert Ng',
    title: 'CTO', email: 'robert@summitcap.com', phone: '555-0707',
    website: 'summitcap.com',
    isPrimary: true, owner: 'Sarah Chen', tags: ['High Value', 'Tech'],
    createdDate: '2026-02-01', lastActivity: '4 days ago',
    contactNotes: [
      { id: 'cn9a', body: 'Notes from Granola: Robert confirmed 3 core needs — investor portal (secure login, doc management, reporting dashboard), full rebrand (they want to move away from the "stuffy finance" look), and marketing automation stack (HubSpot preferred). He has final say on tech but Angela Ross (CEO) has final budget approval. Need to loop Angela in for proposal presentation.', date: '2026-02-23', author: 'Sarah Chen' },
      { id: 'cn9b', body: 'Robert opened the proposal — tracking shows 12 min of review time. He hasn\'t responded yet. I expect he\'s passing it to Angela. Will wait until Monday before following up.', date: '2026-02-25', author: 'Sarah Chen' },
    ],
    contactTasks: [
      { id: 'ct9a', title: 'Follow up with Robert — proposal response', taskType: 'follow_up', dueDate: '2026-03-03', completed: false, priority: 'high', assignedTo: 'Sarah Chen', notes: 'He\'s been reviewing proposal — give him until Monday before pushing' },
      { id: 'ct9b', title: 'Schedule joint call with Robert + Angela Ross', taskType: 'meeting', dueDate: '2026-03-10', completed: false, priority: 'high', assignedTo: 'Sarah Chen', notes: 'Angela has budget authority — get her in the room for proposal walkthrough' },
    ],
  },
  {
    id: 'cc10', companyId: 'comp7', companyName: 'Summit Capital',
    firstName: 'Angela', lastName: 'Ross', fullName: 'Angela Ross',
    title: 'CEO', email: 'angela@summitcap.com', phone: '555-0708',
    isPrimary: false, owner: 'Sarah Chen', tags: ['Decision Maker', 'Executive'],
    createdDate: '2026-02-05', lastActivity: '1 week ago',
  },
  {
    id: 'cc11', companyId: 'comp8', companyName: 'GreenLeaf Organics',
    firstName: 'Olivia', lastName: 'Grant', fullName: 'Olivia Grant',
    title: 'Chief Marketing Officer', email: 'olivia@greenleaf.com', phone: '555-0808',
    website: 'greenleaforganics.com',
    isPrimary: true, owner: 'Marcus Webb', tags: ['Qualified Lead', 'Organic'],
    createdDate: '2026-02-12', lastActivity: '6 days ago',
    contactTasks: [
      { id: 'ct11a', title: 'Send intro email and schedule discovery call', taskType: 'email', dueDate: '2026-03-01', completed: false, priority: 'medium', assignedTo: 'Marcus Webb' },
    ],
  },
  {
    id: 'cc12', companyId: 'comp9', companyName: 'NovaBuild Corp',
    firstName: 'Derek', lastName: 'Santos', fullName: 'Derek Santos',
    title: 'VP Operations', email: 'derek@novabuild.com', phone: '555-0909',
    website: 'novabuild.com',
    isPrimary: true, owner: 'Sarah Chen', tags: ['Renewal Due', 'Construction'],
    createdDate: '2025-04-10', lastActivity: '2 weeks ago',
    contactTasks: [
      { id: 'ct12a', title: 'Send renewal proposal before contract lapses', taskType: 'proposal', dueDate: '2026-03-01', completed: false, priority: 'high', assignedTo: 'Sarah Chen', notes: 'Contract expires March 15 — must act before then' },
    ],
  },
  {
    id: 'cc13', companyId: 'comp10', companyName: 'ClearPath Media',
    firstName: 'Jenna', lastName: 'Holt', fullName: 'Jenna Holt',
    title: 'CEO', email: 'jenna@clearpth.com', phone: '555-1010',
    website: 'clearpth.com',
    isPrimary: true, owner: 'Marcus Webb', tags: ['Renewal Due', 'Media'],
    createdDate: '2025-05-01', lastActivity: '1 week ago',
    contactTasks: [
      { id: 'ct13a', title: 'Schedule renewal discussion call', taskType: 'call', dueDate: '2026-03-03', completed: false, priority: 'high', assignedTo: 'Marcus Webb', notes: 'Contract ends April 1 — need 30 day notice. Call this week.' },
    ],
  },
]

export const crmCompanies: CRMCompany[] = [
  { id: 'comp1', name: 'Apex Solutions', industry: 'Technology', website: 'apexsolutions.com', phone: '555-0100', hq: 'Austin, TX', size: '51-200', annualRevenue: 8000000, status: 'Prospect', owner: 'Sarah Chen', description: 'B2B SaaS company specializing in workflow automation tools.', tags: ['Tech', 'B2B', 'High Potential'], contactIds: ['cc1', 'cc2'], dealIds: ['d1'], createdDate: '2026-01-15', lastActivity: '2 days ago', totalDealValue: 18500 },
  { id: 'comp2', name: 'BlueStar Logistics', industry: 'Logistics & Supply Chain', website: 'bluestarlogistics.com', phone: '555-0200', hq: 'Dallas, TX', size: '201-500', annualRevenue: 45000000, status: 'Active Client', owner: 'Marcus Webb', description: 'Regional logistics company providing last-mile delivery solutions.', tags: ['Logistics', 'Signed', 'SEO Client'], contactIds: ['cc3', 'cc4'], dealIds: ['d2'], createdDate: '2025-11-10', lastActivity: '1 day ago', totalDealValue: 32000 },
  { id: 'comp3', name: 'Meridian Healthcare', industry: 'Healthcare', website: 'meridianhc.com', phone: '555-0300', hq: 'Houston, TX', size: '201-500', annualRevenue: 22000000, status: 'Prospect', owner: 'Sarah Chen', description: 'Multi-specialty healthcare group with 12 locations across Texas.', tags: ['Healthcare', 'High Value', 'Warm'], contactIds: ['cc5'], dealIds: ['d3'], createdDate: '2026-01-28', lastActivity: '3 days ago', totalDealValue: 45000 },
  { id: 'comp4', name: 'TechFlow Inc', industry: 'Technology', website: 'techflowinc.com', phone: '555-0400', hq: 'Austin, TX', size: '1-10', annualRevenue: 500000, status: 'Prospect', owner: 'Marcus Webb', description: 'Early-stage startup building dev tools for engineering teams.', tags: ['Startup', 'Small Budget', 'Social Media'], contactIds: ['cc6'], dealIds: ['d4'], createdDate: '2026-02-10', lastActivity: '1 week ago', totalDealValue: 9800 },
  { id: 'comp5', name: 'Coastal Realty', industry: 'Real Estate', website: 'coastalrealty.com', phone: '555-0500', hq: 'Galveston, TX', size: '11-50', annualRevenue: 5000000, status: 'Active Client', owner: 'Sarah Chen', description: 'Full-service real estate brokerage specializing in coastal and luxury properties.', tags: ['Real Estate', 'Website Client', 'Active'], contactIds: ['cc7'], dealIds: ['d5'], createdDate: '2025-10-05', lastActivity: 'Today', totalDealValue: 27500 },
  { id: 'comp6', name: 'Harvest Foods', industry: 'Food & Beverage', website: 'harvestfoods.com', phone: '555-0600', hq: 'San Antonio, TX', size: '51-200', annualRevenue: 12000000, status: 'Active Client', owner: 'Marcus Webb', description: 'Organic food distributor with direct-to-consumer and wholesale channels.', tags: ['Food', 'Email Client', 'Upsell'], contactIds: ['cc8'], dealIds: ['d6'], createdDate: '2025-09-15', lastActivity: '3 days ago', totalDealValue: 14200 },
  { id: 'comp7', name: 'Summit Capital', industry: 'Finance & Investment', website: 'summitcap.com', phone: '555-0700', hq: 'Dallas, TX', size: '11-50', annualRevenue: 95000000, status: 'Prospect', owner: 'Sarah Chen', description: 'Private equity and venture capital firm. Needs full digital infrastructure overhaul.', tags: ['Finance', 'High Value', 'Custom Build'], contactIds: ['cc9', 'cc10'], dealIds: ['d7'], createdDate: '2026-02-01', lastActivity: '4 days ago', totalDealValue: 52000 },
  { id: 'comp8', name: 'GreenLeaf Organics', industry: 'Consumer Goods', website: 'greenleaforganics.com', phone: '555-0800', hq: 'Austin, TX', size: '11-50', annualRevenue: 2500000, status: 'Prospect', owner: 'Marcus Webb', description: 'Direct-to-consumer organic skincare brand growing through social media.', tags: ['Organic', 'Social Media', 'DTC'], contactIds: ['cc11'], dealIds: ['d8'], createdDate: '2026-02-12', lastActivity: '6 days ago', totalDealValue: 11000 },
  { id: 'comp9', name: 'NovaBuild Corp', industry: 'Construction', website: 'novabuild.com', phone: '555-0900', hq: 'Fort Worth, TX', size: '51-200', annualRevenue: 18000000, status: 'Active Client', owner: 'Sarah Chen', description: 'Commercial and residential construction company with 15 years in market.', tags: ['Construction', 'SEO', 'Renewal'], contactIds: ['cc12'], dealIds: [], createdDate: '2025-04-10', lastActivity: '2 weeks ago', totalDealValue: 28000 },
  { id: 'comp10', name: 'ClearPath Media', industry: 'Media & Entertainment', website: 'clearpth.com', phone: '555-1000', hq: 'Houston, TX', size: '1-10', annualRevenue: 800000, status: 'Active Client', owner: 'Marcus Webb', description: 'Independent media production company. Social media client up for renewal.', tags: ['Media', 'Social Media', 'Renewal'], contactIds: ['cc13'], dealIds: [], createdDate: '2025-05-01', lastActivity: '1 week ago', totalDealValue: 9600 },
]

export const crmActivities: CRMActivity[] = [
  { id: 'ca1', type: 'call', title: 'Discovery call with Marcus Rivera', body: 'Discussed full website redesign scope. Client confirmed $15K budget. Needs e-commerce functionality. Schedule proposal review by March 1.', companyId: 'comp1', companyName: 'Apex Solutions', contactId: 'cc1', contactName: 'Marcus Rivera', user: 'Sarah Chen', timestamp: '2026-02-24 10:30', duration: 45, outcome: 'Positive', nextStep: 'Send proposal by Feb 28' },
  { id: 'ca2', type: 'email', title: 'Proposal sent — Website Redesign', body: 'Sent proposal for $18,500 website redesign. Included scope, timeline, and pricing breakdown. Awaiting review.', companyId: 'comp1', companyName: 'Apex Solutions', contactId: 'cc1', contactName: 'Marcus Rivera', user: 'Sarah Chen', timestamp: '2026-02-20 14:00', outcome: 'Sent', nextStep: 'Follow up if no response by March 1' },
  { id: 'ca3', type: 'meeting', title: 'Contract negotiation meeting', body: 'In-person meeting at BlueStar offices. Reviewed all contract terms. Client happy with scope. Agreed on revised payment schedule.', companyId: 'comp2', companyName: 'BlueStar Logistics', contactId: 'cc3', contactName: 'Kelly Shaw', user: 'Marcus Webb', timestamp: '2026-02-17 09:00', duration: 90, outcome: 'Contract agreed', nextStep: 'Send final contract for e-signature' },
  { id: 'ca4', type: 'call', title: 'Initial outreach — Meridian Healthcare', body: 'Cold outreach converted to intro call. CMO very interested in brand overhaul. Competing with 2 agencies. Need to differentiate on healthcare expertise.', companyId: 'comp3', companyName: 'Meridian Healthcare', contactId: 'cc5', contactName: 'Dr. Nina Okafor', user: 'Sarah Chen', timestamp: '2026-02-22 11:00', duration: 30, outcome: 'Scheduled follow-up', nextStep: 'Send credentials deck & case studies' },
  { id: 'ca5', type: 'note', title: 'Summit Capital — key requirements noted', body: 'Robert Ng confirmed they need: (1) investor portal, (2) full rebrand, (3) marketing automation stack. Budget is flexible. Timeline is Q2 2026. This is a flagship opportunity.', companyId: 'comp7', companyName: 'Summit Capital', contactId: 'cc9', contactName: 'Robert Ng', user: 'Sarah Chen', timestamp: '2026-02-23 16:00' },
  { id: 'ca6', type: 'email', title: 'Proposal viewed notification', body: 'DocuSign tracking shows Robert Ng opened the proposal at 9:14 AM and spent 12 minutes reviewing it. No response yet.', companyId: 'comp7', companyName: 'Summit Capital', contactId: 'cc9', contactName: 'Robert Ng', user: 'System', timestamp: '2026-02-24 09:14' },
  { id: 'ca7', type: 'call', title: 'Monthly check-in — Harvest Foods', body: 'Checked in with Frank about email campaign performance. Open rate up 22% since launch. He mentioned interest in adding SEO. Flagged as upsell opportunity.', companyId: 'comp6', companyName: 'Harvest Foods', contactId: 'cc8', contactName: 'Frank Lopez', user: 'Marcus Webb', timestamp: '2026-02-23 14:30', duration: 20, outcome: 'Upsell opportunity identified' },
  { id: 'ca8', type: 'meeting', title: 'Project kick-off — Coastal Realty', body: 'Kick-off meeting with Dana Kim and Jordan Ellis. Reviewed sitemap, shared brand guidelines. Client excited. Agreed on weekly progress updates every Tuesday.', companyId: 'comp5', companyName: 'Coastal Realty', contactId: 'cc7', contactName: 'Dana Kim', user: 'Jordan Ellis', timestamp: '2026-02-20 13:00', duration: 60, outcome: 'Project started', nextStep: 'Deliver wireframes by March 5' },
  { id: 'ca9', type: 'task', title: 'Send renewal proposal — ProVenture LLC', body: 'Renewal is 3 days away. Must send renewal proposal today or risk churn.', companyId: 'comp1', companyName: 'ProVenture LLC', user: 'Sarah Chen', timestamp: '2026-02-26 08:00', nextStep: 'URGENT: Send renewal proposal' },
  { id: 'ca10', type: 'email', title: 'Follow-up after no response — TechFlow', body: 'Sent second follow-up email to Sam Torres. Still no response after first outreach 1 week ago.', companyId: 'comp4', companyName: 'TechFlow Inc', contactId: 'cc6', contactName: 'Sam Torres', user: 'Marcus Webb', timestamp: '2026-02-19 10:00' },
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
