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
