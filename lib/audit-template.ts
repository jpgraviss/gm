/**
 * Standard Website and SEO Evaluation template configuration.
 * Defines the deliverable format, brand setup, section ordering,
 * and writing rules for all audit reports.
 */

import { BRAND_COLORS, BRAND_FONTS, GRADE_COLORS } from '@/lib/brand'

export const BRAND_SETUP = {
  colors: {
    forestGreen: BRAND_COLORS.primary,
    warmCream: BRAND_COLORS.secondary,
    terracotta: BRAND_COLORS.accent,
    ink: BRAND_COLORS.ink,
    stone: BRAND_COLORS.stone,
    darkBg: BRAND_COLORS.darkBg,
  },
  fonts: BRAND_FONTS,
  usage: {
    forestGreen: 'Headers, borders, CTA buttons, score indicators',
    warmCream: 'Page background, card backgrounds, highlight blocks',
    terracotta: 'Accent badges, secondary CTA, callout icons',
    ink: 'Body text, section titles',
    stone: 'Captions, metadata, muted annotations',
  },
} as const

export const WRITING_RULES = [
  'Never use em dashes or en dashes - always use a straight hyphen surrounded by spaces',
  'Never use curly (smart) quotes - use straight single and double ASCII quotes only',
  'Never use ellipsis character - type three periods if needed',
  'Write in active voice with Flesch-Kincaid Grade 8 readability',
  'Front-load each bullet with the most important word',
  'End every recommendation with a measurable outcome when possible',
] as const

export const EVALUATION_SECTIONS = [
  {
    order: 1,
    key: 'executive_summary',
    label: 'Executive Summary',
    type: 'hero',
    description: 'Hero banner with overall score, grade, and 3 sentence summary',
  },
  {
    order: 2,
    key: 'scorecard',
    label: 'Scorecard',
    type: 'scorecard',
    description: 'Eight category scores with letter grades in a grid layout',
  },
  {
    order: 3,
    key: 'seo_onpage',
    label: 'On-Page SEO',
    type: 'analysis',
    description: 'Title tags, meta descriptions, header hierarchy, keyword usage, internal links, image alt text, URL structure, schema markup',
  },
  {
    order: 4,
    key: 'seo_technical',
    label: 'Technical SEO',
    type: 'analysis',
    description: 'Site speed, Core Web Vitals, mobile-friendliness, SSL/HTTPS, XML sitemap, robots.txt, canonical tags, crawlability, JS rendering',
  },
  {
    order: 5,
    key: 'seo_offpage',
    label: 'Off-Page SEO & Authority',
    type: 'analysis',
    description: 'Domain authority, backlink profile, local SEO, social presence, brand mentions, directory listings, content marketing potential',
  },
  {
    order: 6,
    key: 'content_quality',
    label: 'Content Quality',
    type: 'analysis',
    description: 'Relevance, writing quality, freshness, unique value, blog quality, CTA effectiveness, content gaps, E-E-A-T signals',
  },
  {
    order: 7,
    key: 'ux_design',
    label: 'UX & Design',
    type: 'analysis',
    description: 'Visual design, navigation clarity, page layout, typography, color contrast, form usability, load experience, trust signals',
  },
  {
    order: 8,
    key: 'conversion',
    label: 'Conversion Optimization',
    type: 'analysis',
    description: 'CTA placement, lead capture, value proposition, social proof, contact accessibility, pricing transparency, landing pages, funnel flow',
  },
  {
    order: 9,
    key: 'performance',
    label: 'Performance & Security',
    type: 'analysis',
    description: 'Page load speed, image optimization, code minification, CDN, SSL, security headers, cookie consent, GDPR/CCPA readiness',
  },
  {
    order: 10,
    key: 'mobile',
    label: 'Mobile Experience',
    type: 'analysis',
    description: 'Responsive design, touch targets, mobile navigation, mobile speed, content adjustments, viewport config, font sizes, form usability',
  },
  {
    order: 11,
    key: 'action_plan',
    label: 'Action Plan',
    type: 'action_plan',
    description: 'Top 10 prioritized recommendations with expected impact, effort level, and timeline',
  },
  {
    order: 12,
    key: 'about_next_steps',
    label: 'About Graviss Marketing / Next Steps',
    type: 'closing',
    description: 'Company overview, service offerings, contact info, and CTA for a strategy call',
  },
] as const

export const SECTION_TEMPLATE = {
  analysis: {
    structure: [
      'Section header with score badge and letter grade',
      '3 to 5 specific findings (what was observed)',
      '3 to 5 actionable recommendations (what to do)',
      'Each recommendation includes expected impact',
    ],
  },
  scorecard: {
    layout: '2x4 grid of category cards',
    cardContent: 'Category name, score (0-100), letter grade, one-line summary',
    gradeScale: {
      A: { min: 90, color: GRADE_COLORS.A, label: 'Excellent' },
      B: { min: 80, color: GRADE_COLORS.B, label: 'Good' },
      C: { min: 70, color: GRADE_COLORS.C, label: 'Needs Work' },
      D: { min: 60, color: GRADE_COLORS.D, label: 'Poor' },
      F: { min: 0, color: GRADE_COLORS.F, label: 'Critical' },
    },
  },
  hero: {
    layout: 'Full-width banner with dark background',
    content: 'Company logo, overall score circle, letter grade, 3-sentence summary',
  },
  action_plan: {
    layout: 'Numbered list with priority badges',
    columns: ['Priority', 'Recommendation', 'Impact', 'Effort', 'Timeline'],
  },
} as const

export function getAuditSystemPrompt(): string {
  return `You are a professional website and SEO auditor at Graviss Marketing, a full-service digital marketing agency. You provide detailed, specific, and actionable analysis for clients.

Writing rules:
${WRITING_RULES.map(r => `- ${r}`).join('\n')}

Always respond with a JSON object containing:
{
  "score": <number 0-100>,
  "findings": [<array of 3-5 specific observations>],
  "recommendations": [<array of 3-5 actionable improvements with expected impact>]
}

Be specific - cite observable patterns from the URL structure, domain, and content. Every recommendation must be actionable with a clear next step. Respond ONLY with the JSON object, no markdown or explanation.`
}
