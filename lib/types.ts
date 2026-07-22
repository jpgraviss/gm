import type { ServiceName, LegacyServiceName } from './services'

export type DealStage = string

export type ProposalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Viewed' | 'Accepted' | 'Declined'

/** Sellable service names (see lib/services.ts), plus legacy free-text
 * values that predate the current catalog — both are valid since the
 * underlying DB columns are free text with no CHECK constraint. */
export type TeamServiceLine = ServiceName | LegacyServiceName

export interface AttachedDocument {
  id: string
  name: string
  type: string
  size: number
  uploadedDate: string
  dataUrl: string
}

export type ContractStatus =
  | 'Draft'
  | 'Sent'
  | 'Viewed'
  | 'Signed by Client'
  | 'Countersign Needed'
  | 'Fully Executed'
  | 'Expired'
  | 'Terminated'

export type InvoiceStatus = 'Pending' | 'Sent' | 'Overdue' | 'Paid' | 'Cancelled'

export type ProjectStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Awaiting Client'
  | 'Completed'
  | 'Launched'
  | 'In Maintenance'

export type ServiceType = ServiceName | LegacyServiceName

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

export interface TimeEntry {
  id: string
  date: string
  projectId?: string
  projectName?: string
  description: string
  teamMember: string
  serviceType: TeamServiceLine
  hours: number
  minutes: number
  billable: boolean
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: string
  rejectionNote?: string
}

export type RenewalStatus = 'Upcoming' | 'In Progress' | 'Renewed' | 'Churned'

export type MaintenanceStatus = 'Active' | 'Onboarding' | 'Pending Cancellation' | 'Cancelled' | 'Past'

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
  serviceTypes?: ServiceType[]
  closeDate: string
  assignedRep: string
  probability: number
  notes: string[]
  lastActivity: string
  pipelineId?: string
  companyId?: string | null
  contactId?: string | null
  dealScore?: number
  dealScoreFactors?: { label: string; detail: string; positive: boolean }[]
  customFields?: Record<string, string>
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
  // Approval workflow
  submittedForApprovalDate?: string
  approvedBy?: string
  approvedDate?: string
  rejectedBy?: string
  rejectedDate?: string
  // Renewal/internal
  isRenewal?: boolean
  internalOnly?: boolean
  renewalNotes?: string
  // AI-generated proposals (Generate Proposal pipeline)
  pdfPath?: string
  formSubmissionId?: string
  generationNotes?: string
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
  terminatedReason?: string
  terminatedDate?: string
  companyId?: string | null
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
  companyId?: string | null
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
  serviceTypes?: ServiceType[]
  status: ProjectStatus
  startDate: string
  launchDate: string
  maintenanceStartDate?: string
  assignedTeam: string[]
  progress: number
  milestones: Milestone[]
  tasks: Task[]
  notes?: Array<{ id: string; text: string; date: string; author: string }>
  overview?: string
  sections?: string[]
  color?: string
  description?: string
  companyId?: string | null
}

export interface MaintenanceRecord {
  id: string
  company: string
  serviceType: ServiceType
  startDate: string
  endDate?: string
  monthlyFee: number
  contractDuration: number  // auto-computed from startDate → endDate in months
  cancellationWindow: number
  cancellationFee?: number  // defaults to 3x monthlyFee, configurable per contract terms
  paymentTerms?: string     // e.g. "Net 30", "End of service", "End of 30 days"
  status: MaintenanceStatus
  nextBillingDate: string
  documents?: AttachedDocument[]
  companyId?: string | null
  contractId?: string
}

export interface RenewalProposalData {
  newMonthlyRate: number
  contractMonths: number
  setupFee: number
  notes: string
  increasePercent: number
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
  proposalData?: RenewalProposalData | null
  companyId?: string | null
}

export interface EmailSignatureData {
  name: string
  title: string
  email: string
  phone: string
  website: string
  linkedIn: string
  photoUrl: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: MembershipLevel
  unit: OccupationalUnit
  initials: string
  emailSignature?: EmailSignatureData
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

export type AppTaskCategory = 'Deal' | 'Contract' | 'Billing' | 'Renewal' | 'Project' | 'Ticket' | 'Email' | 'General'
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
  teamServiceLine?: TeamServiceLine
  recurrence?: { frequency: 'daily' | 'weekly' | 'monthly'; interval: number; endDate?: string } | null
  parentTaskId?: string
  projectId?: string
  section?: string
  sortOrder?: number
  companyId?: string | null
  department?: string | null
}

// ─── Sequences (multi-step email/task cadences) ───────────────────────────────

export type SequenceStatus = 'Active' | 'Paused' | 'Draft' | 'Completed'
export type SequenceStepType = 'email' | 'manual_email' | 'wait' | 'task' | 'condition' | 'linkedin' | 'call'
export type SequenceHtmlTemplate = 'branded' | 'minimal' | 'plain'

export interface SequenceStep {
  id: string
  type: SequenceStepType
  day: number
  subject?: string
  body?: string
  htmlTemplate?: SequenceHtmlTemplate
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  fromName?: string
  fromEmail?: string
  waitDays?: number
  taskTitle?: string
  taskPriority?: TaskPriority
  pauseUntilComplete?: boolean
  condition?: string
  // A/B testing — fully executed by app/api/sequences/execute/route.ts's
  // resolveAbVariant() and app/api/sequences/analytics/route.ts (see AUDIT.md #24)
  abEnabled?: boolean
  variantB?: { subject?: string; body?: string }
  abSplit?: number // percentage for variant A (default 50)
  abWinner?: 'A' | 'B' | null
  // LinkedIn — UI placeholder only, no Sales Navigator integration
  linkedinAction?: 'connect' | 'inmail' | 'view_profile'
  linkedinMessage?: string
  callScript?: string
}

export interface EmailSequence {
  id: string
  name: string
  status: SequenceStatus
  trigger: string
  targetSegment: string
  enrolledCount: number
  activeCount: number
  completedCount: number
  openRate: number
  clickRate: number
  replyRate: number
  meetingRate?: number
  bounceRate?: number
  unsubscribeRate?: number
  steps: SequenceStep[]
  createdDate: string
  lastModified: string
  sendVia: 'gmail' | 'resend'
  fromName?: string
  fromEmail?: string
  assignedRepId?: string | null
  owner?: string
  dailySendLimit?: number
  perMinuteLimit?: number
  sendWindowStart?: number
  sendWindowEnd?: number
  sendOnWeekends?: boolean
  timezone?: string
  threadMode?: boolean
  sharing?: 'private' | 'everyone'
  folder?: string | null
}

// ─── Full CRM Types ──────────────────────────────────────────────────────────

export interface SignatureRequest {
  id: string
  contractId: string
  token: string
  signerEmail: string
  signerName?: string
  type: 'client' | 'internal'
  status: 'pending' | 'signed' | 'expired'
  signedAt?: string
  signerIp?: string
  signatureData?: string
  createdAt: string
  expiresAt: string
}

export type CompanyStatus = 'Prospect' | 'Active Client' | 'Past Client' | 'Partner' | 'Churned'
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001-5000' | '5001-10000' | '10001+' | '500+'
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'call_note' | 'task' | 'deal' | 'contract' | 'invoice' | 'proposal'
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

export type ContactLifecycleStage = 'lead' | 'opportunity' | 'client' | 'other'
export type ContactLeadStatus = 'new' | 'open' | 'in_progress' | 'open_deal' | 'unqualified' | 'attempted_to_contact' | 'connected' | 'bad_timing'

export interface HubSpotData {
  mobilePhone?: string
  industry?: string
  annualRevenue?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  twitterHandle?: string
  facebookPage?: string
  dateOfBirth?: string
  hubspotCreateDate?: string
  hubspotLastModified?: string
  analyticsSource?: string
  analyticsSourceData?: string
  lastContacted?: string
  lastActivityDate?: string
  numContactedNotes?: string
  emailDomain?: string
  marketableStatus?: string
  hubspotOwnerId?: string
  associatedCompanyId?: string
  lifecycleStage?: string
}

export interface CRMContact {
  id: string
  companyId: string
  companyName: string
  firstName: string
  lastName: string
  fullName: string
  title: string
  emails: string[]
  phones: string[]
  linkedIn?: string
  website?: string
  isPrimary: boolean
  owner: string
  ownerId?: string | null
  tags: string[]
  notes?: string
  contactNotes?: ContactNote[]
  contactTasks?: ContactTask[]
  createdDate: string
  lastActivity?: string
  lifecycleStage?: ContactLifecycleStage
  leadStatus?: ContactLeadStatus
  hubspotData?: HubSpotData
  customFields?: Record<string, string>
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
  notes?: string
  customFields?: Record<string, string>
}

export type CustomFieldEntityType = 'contacts' | 'companies' | 'deals'
export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select'

export interface CustomFieldDefinition {
  id: string
  entityType: CustomFieldEntityType
  fieldKey: string
  label: string
  fieldType: CustomFieldType
  options: string[]
  sortOrder: number
  createdDate: string
}

export type SavedFilterEntityType = 'contacts' | 'companies' | 'deals'

export interface SavedFilter {
  id: string
  name: string
  entityType: SavedFilterEntityType
  criteria: Record<string, string>
  createdBy?: string
  createdDate: string
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

// ── Website / SEO Audit ─────────────────────────────────────────────────────

export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed'
export type AuditType = 'full' | 'seo' | 'website'

export interface AuditSectionResult {
  name: string
  score: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  findings: string[]
  recommendations: string[]
  // AUDIT — true when no AI provider was reachable for this section after
  // retries. score/grade are 0/F placeholders only so downstream math
  // doesn't crash on undefined; never render them as a real finding.
  unavailable?: boolean
}

export interface AuditResult {
  id: string
  websiteUrl: string
  companyId?: string
  companyName?: string
  auditType: AuditType
  status: AuditStatus
  overallScore?: number
  overallGrade?: string
  summary?: string
  sections: AuditSectionResult[]
  createdAt: string
  completedAt?: string
}

