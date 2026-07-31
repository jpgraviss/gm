// ─── Fake demo data for the /demo walkthrough ─────────────────────────────
// Everything here is invented for illustration — no real client names,
// no real dollar figures, no real anything. Do not add real data here.

export interface DemoDeal {
  company: string
  initials: string
  value: number
  stage: 'prospect' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won'
  lastActivity: string
}

export const PIPELINE_STAGES: { key: DemoDeal['stage']; name: string; color: string }[] = [
  { key: 'prospect', name: 'Prospect', color: '#8C8478' },
  { key: 'qualified', name: 'Qualified', color: '#6b8fae' },
  { key: 'proposal', name: 'Proposal Sent', color: '#CC7853' },
  { key: 'negotiation', name: 'Negotiation', color: '#01673f' },
  { key: 'closed_won', name: 'Closed Won', color: '#015035' },
]

export const DEALS: DemoDeal[] = [
  { company: 'Anchor Outdoor', initials: 'AO', value: 4200, stage: 'prospect', lastActivity: '2 days ago' },
  { company: 'Wayfinder Coffee', initials: 'WC', value: 1900, stage: 'prospect', lastActivity: '5 days ago' },
  { company: 'Coastal Fitness Co.', initials: 'CF', value: 2600, stage: 'prospect', lastActivity: 'Today' },
  { company: 'Highline Roofing', initials: 'HR', value: 3400, stage: 'qualified', lastActivity: 'Yesterday' },
  { company: 'Northgate Veterinary', initials: 'NV', value: 2100, stage: 'qualified', lastActivity: '3 days ago' },
  { company: 'Riverside Dental', initials: 'RD', value: 2800, stage: 'proposal', lastActivity: 'Today' },
  { company: 'Blue Ridge Auto', initials: 'BA', value: 5400, stage: 'proposal', lastActivity: '1 day ago' },
  { company: 'Meridian HVAC', initials: 'MH', value: 6500, stage: 'negotiation', lastActivity: 'Today' },
  { company: 'Palmetto Realty', initials: 'PR', value: 3100, stage: 'closed_won', lastActivity: '1 week ago' },
  { company: 'Sunbelt Landscaping', initials: 'SL', value: 2900, stage: 'closed_won', lastActivity: '2 weeks ago' },
]

export interface DemoProposal {
  id: string
  company: string
  title: string
  status: 'Sent' | 'Awaiting Signature' | 'Signed'
  sentDaysAgo: number
  viewedDaysAgo: number | null
  monthly: string
  items: { name: string; detail: string; price: string }[]
}

export const PROPOSALS: DemoProposal[] = [
  {
    id: 'meridian',
    company: 'Meridian HVAC',
    title: 'Website + SEO',
    status: 'Awaiting Signature',
    sentDaysAgo: 5,
    viewedDaysAgo: 2,
    monthly: '$2,500/mo',
    items: [
      { name: 'Website Redesign', detail: 'One-time build, 6-page site', price: '$3,500' },
      { name: 'SEO Management', detail: 'Ongoing optimization & reporting', price: '$1,800/mo' },
      { name: 'Content & Local SEO', detail: 'Blog + Google Business Profile', price: '$700/mo' },
    ],
  },
  {
    id: 'blueridge',
    company: 'Blue Ridge Auto',
    title: 'Full-Service Marketing',
    status: 'Sent',
    sentDaysAgo: 1,
    viewedDaysAgo: null,
    monthly: '$4,800/mo',
    items: [
      { name: 'Paid Search & Social', detail: 'Managed ad spend + creative', price: '$2,600/mo' },
      { name: 'SEO Management', detail: 'Ongoing optimization & reporting', price: '$1,500/mo' },
      { name: 'Reputation Management', detail: 'Review monitoring & response', price: '$700/mo' },
    ],
  },
  {
    id: 'riverside',
    company: 'Riverside Dental',
    title: 'SEO & Reputation',
    status: 'Sent',
    sentDaysAgo: 3,
    viewedDaysAgo: 3,
    monthly: '$1,600/mo',
    items: [
      { name: 'SEO Management', detail: 'Ongoing optimization & reporting', price: '$1,100/mo' },
      { name: 'Reputation Management', detail: 'Review monitoring & response', price: '$500/mo' },
    ],
  },
]

export const PORTAL_CLIENT = {
  name: 'Palmetto Realty',
  seoScore: 72,
  seoScoreDelta: 9,
  seoTrend: [54, 58, 61, 65, 63, 68, 72],
  invoice: { amount: '$3,100', due: 'Aug 15' },
  services: ['SEO Management', 'Social Media', 'Website Care Plan'],
  tickets: [
    { id: 482, subject: 'Question about GBP reviews', status: 'Open' },
    { id: 471, subject: 'New listing photos for homepage', status: 'Resolved' },
  ],
  approvals: [
    { label: 'Instagram post — “Fall Listings”' },
    { label: 'Blog post — “Fall Market Update”' },
  ],
  activity: [
    { text: 'SEO report for July delivered', time: '2 days ago' },
    { text: 'Invoice #1042 paid', time: '1 week ago' },
    { text: 'New blog post published: “5 Tips for Fall Buyers”', time: '2 weeks ago' },
  ],
}

export const KPIS = [
  { label: 'MRR', value: '$184.5k', delta: '+6.2%' },
  { label: 'Win Rate', value: '38%', delta: '+3pt' },
  { label: 'Avg Deal', value: '$3,850', delta: '+4.1%' },
  { label: 'Active Clients', value: '47', delta: '+2' },
]

export const REVENUE_TREND = [62, 68, 71, 79, 84, 91]
export const REVENUE_TREND_MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']

export const FUNNEL = [
  { stage: 'Prospect', count: 22 },
  { stage: 'Qualified', count: 14 },
  { stage: 'Proposal', count: 9 },
  { stage: 'Negotiation', count: 5 },
  { stage: 'Closed Won', count: 3 },
]

export const RECENT_WINS = [
  { company: 'Palmetto Realty', value: '$3,100/mo', closedDaysAgo: 7 },
  { company: 'Sunbelt Landscaping', value: '$2,900/mo', closedDaysAgo: 14 },
  { company: 'Northgate Veterinary', value: '$2,100/mo', closedDaysAgo: 21 },
]

export const TOP_SOURCES = [
  { source: 'Referral', pct: 38 },
  { source: 'Organic Search', pct: 27 },
  { source: 'Outbound', pct: 21 },
  { source: 'Paid Ads', pct: 14 },
]
