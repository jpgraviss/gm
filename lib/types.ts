export type DealStage =
  | 'Lead'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Contract Sent'
  | 'Closed Won'
  | 'Closed Lost'

export type ProposalStatus = 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Declined'

export type ContractStatus =
  | 'Draft'
  | 'Sent'
  | 'Viewed'
  | 'Signed by Client'
  | 'Countersign Needed'
  | 'Fully Executed'
  | 'Expired'

export type InvoiceStatus = 'Pending' | 'Sent' | 'Overdue' | 'Paid'

export type ProjectStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Awaiting Client'
  | 'Completed'
  | 'Launched'
  | 'In Maintenance'

export type ServiceType =
  | 'Website'
  | 'SEO'
  | 'Social Media'
  | 'Branding'
  | 'Email Marketing'
  | 'Custom'

export type MembershipLevel =
  | 'Super Admin'
  | 'Leadership'
  | 'Department Manager'
  | 'Team Member'
  | 'Contractor'
  | 'Client'

export type OccupationalUnit =
  | 'Sales'
  | 'Billing/Finance'
  | 'Delivery/Operations'
  | 'Leadership/Admin'
  | 'Contractors'
  | 'Client'

export type TaskPriority = 'Low' | 'Medium' | 'High'

export type RenewalStatus = 'Upcoming' | 'In Progress' | 'Renewed' | 'Churned'

export type MaintenanceStatus = 'Active' | 'Pending Cancellation' | 'Cancelled'

export interface Contact {
  id: string
  name: string
  email: string
  phone: string
  title: string
}

export interface Deal {
  id: string
  company: string
  contact: Contact
  stage: DealStage
  value: number
  serviceType: ServiceType
  closeDate: string
  assignedRep: string
  probability: number
  notes: string[]
  lastActivity: string
}

export interface ProposalLineItem {
  id: string
  description: string
  type: 'one-time' | 'recurring'
  quantity: number
  unitPrice: number
  total: number
}

export interface Proposal {
  id: string
  dealId: string
  company: string
  status: ProposalStatus
  value: number
  serviceType: ServiceType
  createdDate: string
  sentDate?: string
  viewedDate?: string
  respondedDate?: string
  assignedRep: string
  items: ProposalLineItem[]
}

export interface Contract {
  id: string
  proposalId?: string
  company: string
  status: ContractStatus
  value: number
  billingStructure: string
  startDate: string
  duration: number
  renewalDate: string
  assignedRep: string
  serviceType: ServiceType
  clientSigned?: string
  internalSigned?: string
}

export interface Invoice {
  id: string
  contractId: string
  company: string
  amount: number
  status: InvoiceStatus
  dueDate: string
  issuedDate: string
  paidDate?: string
  serviceType: ServiceType
}

export interface Milestone {
  id: string
  name: string
  dueDate: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  assignee: string
  dueDate: string
  completed: boolean
  priority: TaskPriority
}

export interface Project {
  id: string
  contractId: string
  company: string
  serviceType: ServiceType
  status: ProjectStatus
  startDate: string
  launchDate: string
  maintenanceStartDate?: string
  assignedTeam: string[]
  progress: number
  milestones: Milestone[]
  tasks: Task[]
}

export interface MaintenanceRecord {
  id: string
  company: string
  serviceType: ServiceType
  startDate: string
  monthlyFee: number
  contractDuration: number
  cancellationWindow: number
  status: MaintenanceStatus
  nextBillingDate: string
}

export interface Renewal {
  id: string
  company: string
  contractId: string
  expirationDate: string
  renewalValue: number
  assignedRep: string
  status: RenewalStatus
  daysUntilExpiry: number
  serviceType: ServiceType
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: MembershipLevel
  unit: OccupationalUnit
  initials: string
}

export interface ActivityItem {
  id: string
  type: 'deal' | 'contract' | 'invoice' | 'project' | 'proposal' | 'task'
  description: string
  company: string
  timestamp: string
  user: string
}

export interface RevenueMonth {
  month: string
  revenue: number
  recurring: number
}

// ─── Standalone Task (App-wide task management) ──────────────────────────────

export type AppTaskCategory = 'Deal' | 'Contract' | 'Billing' | 'Renewal' | 'Project' | 'Ticket' | 'General'
export type AppTaskStatus = 'Pending' | 'In Progress' | 'Completed'

export interface AppTask {
  id: string
  title: string
  description?: string
  category: AppTaskCategory
  priority: TaskPriority
  status: AppTaskStatus
  company?: string
  assignedTo: string
  dueDate: string
  createdDate: string
  completedDate?: string
  linkedId?: string
}

// ─── Full CRM Types ──────────────────────────────────────────────────────────

export type CompanyStatus = 'Prospect' | 'Active Client' | 'Past Client' | 'Partner' | 'Churned'
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+'
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task' | 'deal' | 'contract' | 'invoice' | 'proposal'
export type ContactTaskType = 'follow_up' | 'call' | 'email' | 'meeting' | 'reschedule' | 'proposal' | 'demo' | 'other'
export type ContactTaskPriority = 'high' | 'medium' | 'low'

export interface ContactNote {
  id: string
  body: string
  date: string
  author: string
}

export interface ContactTask {
  id: string
  title: string
  taskType: ContactTaskType
  dueDate: string
  completed: boolean
  priority: ContactTaskPriority
  assignedTo: string
  notes?: string
}

export interface CRMContact {
  id: string
  companyId: string
  companyName: string
  firstName: string
  lastName: string
  fullName: string
  title: string
  email: string
  phone: string
  mobile?: string
  linkedIn?: string
  website?: string
  isPrimary: boolean
  owner: string
  tags: string[]
  notes?: string
  contactNotes?: ContactNote[]
  contactTasks?: ContactTask[]
  createdDate: string
  lastActivity?: string
}

export interface CRMCompany {
  id: string
  name: string
  industry: string
  website?: string
  phone?: string
  hq: string
  size: CompanySize
  annualRevenue?: number
  status: CompanyStatus
  owner: string
  description?: string
  tags: string[]
  contactIds: string[]
  dealIds: string[]
  createdDate: string
  lastActivity?: string
  totalDealValue: number
}

export interface CRMActivity {
  id: string
  type: ActivityType
  title: string
  body?: string
  companyId?: string
  companyName?: string
  contactId?: string
  contactName?: string
  dealId?: string
  user: string
  timestamp: string
  duration?: number   // minutes, for calls/meetings
  outcome?: string
  nextStep?: string
  pinned?: boolean
}

