export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const stageColors: Record<string, string> = {
  Lead: 'bg-gray-100 text-gray-600',
  Qualified: 'bg-blue-100 text-blue-700',
  'Proposal Sent': 'bg-yellow-100 text-yellow-700',
  'Contract Sent': 'bg-orange-100 text-orange-700',
  'Closed Won': 'bg-green-100 text-green-700',
  'Closed Lost': 'bg-red-100 text-red-600',
}

export const proposalStatusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-teal-100 text-teal-700',
  Sent: 'bg-blue-100 text-blue-700',
  Viewed: 'bg-purple-100 text-purple-700',
  Accepted: 'bg-green-100 text-green-700',
  Declined: 'bg-red-100 text-red-600',
}

export const contractStatusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  Viewed: 'bg-purple-100 text-purple-700',
  'Signed by Client': 'bg-yellow-100 text-yellow-700',
  'Countersign Needed': 'bg-orange-100 text-orange-700',
  'Fully Executed': 'bg-green-100 text-green-700',
  Expired: 'bg-red-100 text-red-600',
}

export const invoiceStatusColors: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-600',
  Paid: 'bg-green-100 text-green-700',
}

export const projectStatusColors: Record<string, string> = {
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Awaiting Client': 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-green-100 text-green-700',
  Launched: 'bg-emerald-100 text-emerald-700',
  'In Maintenance': 'bg-purple-100 text-purple-700',
}

export const serviceTypeColors: Record<string, string> = {
  Website: 'bg-indigo-100 text-indigo-700',
  SEO: 'bg-teal-100 text-teal-700',
  'Social Media': 'bg-pink-100 text-pink-700',
  Branding: 'bg-amber-100 text-amber-700',
  'Email Marketing': 'bg-cyan-100 text-cyan-700',
  Custom: 'bg-violet-100 text-violet-700',
}

export const renewalStatusColors: Record<string, string> = {
  Upcoming: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  Renewed: 'bg-green-100 text-green-700',
  Churned: 'bg-red-100 text-red-600',
}
