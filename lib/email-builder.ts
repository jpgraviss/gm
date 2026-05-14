/**
 * Email builder block types + rendering.
 *
 * The email builder uses a block-based architecture: each email is an
 * ordered array of blocks. Each block has a type (text, image, button,
 * divider, social, spacer, columns) and type-specific content.
 *
 * Blocks render to inline-style HTML for email compatibility (no CSS
 * classes — email clients strip them). The same block definitions are
 * used for both the visual editor and the final HTML output.
 */

export type EmailBlockType =
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'social'
  | 'spacer'
  | 'columns'
  | 'header'

export interface EmailBlock {
  id: string
  type: EmailBlockType
  content: Record<string, unknown>
}

// ─── Default content per block type ─────────────────────────────────────────

export function defaultBlockContent(type: EmailBlockType): Record<string, unknown> {
  switch (type) {
    case 'text':
      return { html: '<p>Write your content here...</p>' }
    case 'image':
      return { src: '', alt: '', width: '100%', align: 'center', link: '' }
    case 'button':
      return { text: 'Click Here', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '12px 24px' }
    case 'divider':
      return { color: '#e5e7eb', thickness: '1px', width: '100%' }
    case 'social':
      return {
        links: [
          { platform: 'facebook', url: '' },
          { platform: 'instagram', url: '' },
          { platform: 'linkedin', url: '' },
          { platform: 'twitter', url: '' },
        ],
        iconSize: '24px',
        align: 'center',
      }
    case 'spacer':
      return { height: '20px' }
    case 'columns':
      return {
        columns: [
          { width: '50%', blocks: [] },
          { width: '50%', blocks: [] },
        ],
      }
    case 'header':
      return { html: '<h1 style="margin:0;">Your Headline</h1>', align: 'center', bgColor: '#015035', textColor: '#ffffff', padding: '32px 24px' }
    default:
      return {}
  }
}

export function newBlock(type: EmailBlockType): EmailBlock {
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    content: defaultBlockContent(type),
  }
}

// ─── Block → HTML rendering ─────────────────────────────────────────────────

function renderTextBlock(content: Record<string, unknown>): string {
  return `<div style="padding:0 24px;font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#374151;">${content.html ?? ''}</div>`
}

function renderImageBlock(content: Record<string, unknown>): string {
  const src = String(content.src ?? '')
  if (!src) return '<div style="padding:24px;text-align:center;color:#9ca3af;font-size:14px;">[Image placeholder]</div>'
  const alt = String(content.alt ?? '')
  const width = String(content.width ?? '100%')
  const align = String(content.align ?? 'center')
  const link = String(content.link ?? '')
  const img = `<img src="${src}" alt="${alt}" width="${width}" style="max-width:100%;height:auto;display:block;${align === 'center' ? 'margin:0 auto;' : ''}" />`
  if (link) return `<div style="padding:0 24px;text-align:${align};"><a href="${link}" target="_blank">${img}</a></div>`
  return `<div style="padding:0 24px;text-align:${align};">${img}</div>`
}

function renderButtonBlock(content: Record<string, unknown>): string {
  const text = String(content.text ?? 'Click Here')
  const url = String(content.url ?? '#')
  const bg = String(content.bgColor ?? '#015035')
  const tc = String(content.textColor ?? '#ffffff')
  const align = String(content.align ?? 'center')
  const radius = String(content.borderRadius ?? '8px')
  const padding = String(content.padding ?? '12px 24px')
  return `<div style="padding:16px 24px;text-align:${align};"><a href="${url}" target="_blank" style="display:inline-block;background:${bg};color:${tc};font-size:16px;font-weight:600;padding:${padding};border-radius:${radius};text-decoration:none;font-family:system-ui,-apple-system,sans-serif;">${text}</a></div>`
}

function renderDividerBlock(content: Record<string, unknown>): string {
  const color = String(content.color ?? '#e5e7eb')
  const thickness = String(content.thickness ?? '1px')
  const width = String(content.width ?? '100%')
  return `<div style="padding:16px 24px;"><hr style="border:none;border-top:${thickness} solid ${color};width:${width};margin:0 auto;" /></div>`
}

function renderSocialBlock(content: Record<string, unknown>): string {
  const links = (content.links ?? []) as Array<{ platform: string; url: string }>
  const align = String(content.align ?? 'center')
  const iconSize = String(content.iconSize ?? '24px')
  const iconMap: Record<string, string> = {
    facebook: '📘', instagram: '📷', linkedin: '💼', twitter: '🐦', youtube: '▶️', tiktok: '🎵',
  }
  const items = links
    .filter(l => l.url)
    .map(l => `<a href="${l.url}" target="_blank" style="display:inline-block;margin:0 6px;font-size:${iconSize};text-decoration:none;">${iconMap[l.platform] ?? '🔗'}</a>`)
    .join('')
  return `<div style="padding:16px 24px;text-align:${align};">${items || '<span style="color:#9ca3af;font-size:14px;">[Add social links]</span>'}</div>`
}

function renderSpacerBlock(content: Record<string, unknown>): string {
  const height = String(content.height ?? '20px')
  return `<div style="height:${height};"></div>`
}

function renderHeaderBlock(content: Record<string, unknown>): string {
  const bg = String(content.bgColor ?? '#015035')
  const tc = String(content.textColor ?? '#ffffff')
  const padding = String(content.padding ?? '32px 24px')
  return `<div style="background:${bg};color:${tc};padding:${padding};font-family:system-ui,-apple-system,sans-serif;">${content.html ?? ''}</div>`
}

export function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case 'text':    return renderTextBlock(block.content)
    case 'image':   return renderImageBlock(block.content)
    case 'button':  return renderButtonBlock(block.content)
    case 'divider': return renderDividerBlock(block.content)
    case 'social':  return renderSocialBlock(block.content)
    case 'spacer':  return renderSpacerBlock(block.content)
    case 'header':  return renderHeaderBlock(block.content)
    case 'columns': return '<div style="padding:0 24px;">[Columns]</div>'
    default:        return ''
  }
}

/**
 * Render an array of blocks into a complete email HTML document.
 * Uses table-based layout for maximum email client compatibility.
 */
export function renderEmailHTML(
  blocks: EmailBlock[],
  options?: {
    bgColor?: string
    contentWidth?: string
    fontFamily?: string
    preheader?: string
  },
): string {
  const bg = options?.bgColor ?? '#f4f4f5'
  const width = options?.contentWidth ?? '600px'
  const font = options?.fontFamily ?? "system-ui, -apple-system, 'Segoe UI', sans-serif"
  const preheader = options?.preheader ?? ''

  const body = blocks.map(b => renderBlock(b)).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title></title>
  <!--[if mso]><style>body{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${bg};font-family:${font};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="max-width:${width};width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td>
              ${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Pre-built templates ────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string
  name: string
  category: 'newsletter' | 'announcement' | 'promotion' | 'welcome' | 'follow-up' | 'event' | 'blank'
  description: string
  blocks: EmailBlock[]
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-blank',
    name: 'Blank',
    category: 'blank',
    description: 'Start from scratch',
    blocks: [],
  },
  {
    id: 'tpl-newsletter',
    name: 'Monthly Newsletter',
    category: 'newsletter',
    description: 'Header, intro, 3 content sections, CTA, social footer',
    blocks: [
      { id: 'b1', type: 'header', content: { html: '<h1 style="margin:0;font-size:24px;">Monthly Update</h1><p style="margin:8px 0 0;opacity:0.8;font-size:14px;">The latest from our team</p>', bgColor: '#015035', textColor: '#ffffff', padding: '32px 24px' } },
      { id: 'b2', type: 'text', content: { html: '<p>Hi {{first_name}},</p><p>Here\'s what happened this month and what\'s coming next.</p>' } },
      { id: 'b3', type: 'divider', content: { color: '#e5e7eb', thickness: '1px', width: '100%' } },
      { id: 'b4', type: 'text', content: { html: '<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Highlight #1</h2><p>Share your first key update or achievement here.</p>' } },
      { id: 'b5', type: 'text', content: { html: '<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Highlight #2</h2><p>Share your second key update or achievement here.</p>' } },
      { id: 'b6', type: 'text', content: { html: '<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Highlight #3</h2><p>Share your third key update or achievement here.</p>' } },
      { id: 'b7', type: 'button', content: { text: 'Read More on Our Blog', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '14px 28px' } },
      { id: 'b8', type: 'spacer', content: { height: '16px' } },
      { id: 'b9', type: 'social', content: { links: [{ platform: 'facebook', url: '' }, { platform: 'instagram', url: '' }, { platform: 'linkedin', url: '' }], iconSize: '24px', align: 'center' } },
    ],
  },
  {
    id: 'tpl-announcement',
    name: 'Big Announcement',
    category: 'announcement',
    description: 'Bold header, announcement text, CTA button',
    blocks: [
      { id: 'b1', type: 'header', content: { html: '<h1 style="margin:0;font-size:28px;">Big News!</h1>', bgColor: '#015035', textColor: '#ffffff', padding: '40px 24px', align: 'center' } },
      { id: 'b2', type: 'spacer', content: { height: '24px' } },
      { id: 'b3', type: 'text', content: { html: '<p style="font-size:18px;text-align:center;">We\'re excited to share something new with you.</p><p style="text-align:center;">Tell your audience what\'s changing, launching, or happening.</p>' } },
      { id: 'b4', type: 'button', content: { text: 'Learn More', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '16px 32px' } },
      { id: 'b5', type: 'spacer', content: { height: '16px' } },
    ],
  },
  {
    id: 'tpl-promotion',
    name: 'Special Offer',
    category: 'promotion',
    description: 'Promo banner, offer details, urgency CTA',
    blocks: [
      { id: 'b1', type: 'header', content: { html: '<p style="margin:0;font-size:14px;text-transform:uppercase;letter-spacing:2px;opacity:0.8;">Limited Time Offer</p><h1 style="margin:8px 0 0;font-size:32px;">25% Off</h1>', bgColor: '#1e293b', textColor: '#ffffff', padding: '40px 24px', align: 'center' } },
      { id: 'b2', type: 'text', content: { html: '<p style="font-size:16px;text-align:center;">For a limited time, get 25% off your next project with us. Use code <strong>GROW25</strong> at checkout.</p>' } },
      { id: 'b3', type: 'button', content: { text: 'Claim Your Discount', url: '', bgColor: '#dc2626', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '16px 32px' } },
      { id: 'b4', type: 'text', content: { html: '<p style="text-align:center;font-size:13px;color:#9ca3af;">Offer expires in 7 days. Terms apply.</p>' } },
    ],
  },
  {
    id: 'tpl-welcome',
    name: 'Welcome Email',
    category: 'welcome',
    description: 'Warm welcome with next steps',
    blocks: [
      { id: 'b1', type: 'header', content: { html: '<h1 style="margin:0;font-size:24px;">Welcome Aboard!</h1>', bgColor: '#015035', textColor: '#ffffff', padding: '32px 24px', align: 'center' } },
      { id: 'b2', type: 'text', content: { html: '<p>Hi {{first_name}},</p><p>Thank you for choosing us. We\'re thrilled to have you on board and can\'t wait to get started.</p><p>Here\'s what happens next:</p><ol><li><strong>Discovery call</strong> — We\'ll schedule a 30-minute call to understand your goals</li><li><strong>Strategy document</strong> — You\'ll receive a customized plan within 48 hours</li><li><strong>Kickoff</strong> — We begin execution immediately after your approval</li></ol>' } },
      { id: 'b3', type: 'button', content: { text: 'Book Your Discovery Call', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '14px 28px' } },
      { id: 'b4', type: 'text', content: { html: '<p>If you have any questions, just reply to this email. We\'re here to help.</p><p>Best,<br/>The Team</p>' } },
    ],
  },
  {
    id: 'tpl-followup',
    name: 'Follow-Up',
    category: 'follow-up',
    description: 'Simple follow-up with clear CTA',
    blocks: [
      { id: 'b1', type: 'text', content: { html: '<p>Hi {{first_name}},</p><p>Just checking in — I wanted to follow up on our recent conversation.</p><p>Is there anything else you need from us to move forward?</p>' } },
      { id: 'b2', type: 'button', content: { text: 'Schedule a Call', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '12px 24px' } },
      { id: 'b3', type: 'text', content: { html: '<p>Looking forward to hearing from you.</p><p>Best,<br/>{{sender_name}}</p>' } },
    ],
  },
  {
    id: 'tpl-event',
    name: 'Event Invitation',
    category: 'event',
    description: 'Event details with RSVP button',
    blocks: [
      { id: 'b1', type: 'header', content: { html: '<p style="margin:0;font-size:14px;text-transform:uppercase;letter-spacing:2px;opacity:0.8;">You\'re Invited</p><h1 style="margin:8px 0 0;font-size:26px;">Marketing Masterclass</h1>', bgColor: '#015035', textColor: '#ffffff', padding: '36px 24px', align: 'center' } },
      { id: 'b2', type: 'text', content: { html: '<p style="text-align:center;"><strong>Date:</strong> Thursday, May 15, 2026<br/><strong>Time:</strong> 2:00 PM ET<br/><strong>Location:</strong> Virtual (Zoom link sent upon RSVP)</p>' } },
      { id: 'b3', type: 'text', content: { html: '<p>Join us for an exclusive session on the latest marketing strategies that are driving results for agencies in 2026.</p><p>You\'ll learn:</p><ul><li>How to leverage AI for client reporting</li><li>SEO strategies that actually move the needle</li><li>Building scalable processes for your agency</li></ul>' } },
      { id: 'b4', type: 'button', content: { text: 'RSVP Now', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '16px 32px' } },
      { id: 'b5', type: 'text', content: { html: '<p style="text-align:center;font-size:13px;color:#9ca3af;">Space is limited. Reserve your spot today.</p>' } },
    ],
  },
  {
    id: 'tpl-case-study',
    name: 'Case Study',
    category: 'newsletter',
    description: 'Client success story with results',
    blocks: [
      { id: 'b1', type: 'header', content: { html: '<p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:2px;opacity:0.7;">Case Study</p><h1 style="margin:8px 0 0;font-size:22px;">How We Helped [Client] Grow 3x</h1>', bgColor: '#015035', textColor: '#ffffff', padding: '32px 24px' } },
      { id: 'b2', type: 'text', content: { html: '<p><strong>The Challenge:</strong> Describe the client\'s problem.</p><p><strong>The Solution:</strong> Describe what you did.</p><p><strong>The Results:</strong></p><ul><li>300% increase in organic traffic</li><li>2x more qualified leads per month</li><li>45% reduction in cost per acquisition</li></ul>' } },
      { id: 'b3', type: 'button', content: { text: 'Read the Full Story', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '14px 28px' } },
      { id: 'b4', type: 'divider', content: { color: '#e5e7eb', thickness: '1px', width: '100%' } },
      { id: 'b5', type: 'text', content: { html: '<p style="font-size:14px;">Want similar results? <a href="" style="color:#015035;font-weight:600;">Let\'s talk →</a></p>' } },
    ],
  },
  {
    id: 'tpl-review-request',
    name: 'Review Request',
    category: 'follow-up',
    description: 'Ask clients for a Google review',
    blocks: [
      { id: 'b1', type: 'text', content: { html: '<p>Hi {{first_name}},</p><p>We hope you\'re happy with the work we\'ve done together. Your feedback means the world to us!</p><p>Would you take 30 seconds to leave us a quick review? It helps other businesses find us.</p>' } },
      { id: 'b2', type: 'button', content: { text: '⭐ Leave a Review', url: '', bgColor: '#f59e0b', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '14px 28px' } },
      { id: 'b3', type: 'text', content: { html: '<p>Thank you for being a valued client!</p><p>Best,<br/>The Team</p>' } },
    ],
  },
  {
    id: 'tpl-monthly-report',
    name: 'Monthly Report',
    category: 'newsletter',
    description: 'Performance summary with key metrics',
    blocks: [
      { id: 'b1', type: 'header', content: { html: '<h1 style="margin:0;font-size:22px;">Your Monthly Report</h1><p style="margin:8px 0 0;opacity:0.8;font-size:14px;">Performance summary for {{month}}</p>', bgColor: '#015035', textColor: '#ffffff', padding: '32px 24px' } },
      { id: 'b2', type: 'text', content: { html: '<p>Hi {{first_name}},</p><p>Here\'s a snapshot of your marketing performance this month.</p>' } },
      { id: 'b3', type: 'text', content: { html: '<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;"><tr><td style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px;"><p style="margin:0;font-size:24px;font-weight:700;color:#015035;">1,247</p><p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Website Visitors</p></td><td style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px;"><p style="margin:0;font-size:24px;font-weight:700;color:#015035;">23</p><p style="margin:4px 0 0;font-size:12px;color:#6b7280;">New Leads</p></td><td style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px;"><p style="margin:0;font-size:24px;font-weight:700;color:#015035;">4.2★</p><p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Avg Rating</p></td></tr></table>' } },
      { id: 'b4', type: 'button', content: { text: 'View Full Report', url: '', bgColor: '#015035', textColor: '#ffffff', align: 'center', borderRadius: '8px', padding: '14px 28px' } },
      { id: 'b5', type: 'text', content: { html: '<p style="font-size:14px;color:#6b7280;">Questions about your report? Just reply to this email.</p>' } },
    ],
  },
]

/**
 * Block type metadata for the editor palette.
 */
export const BLOCK_TYPES: Array<{
  type: EmailBlockType
  label: string
  icon: string
  description: string
}> = [
  { type: 'header',  label: 'Header',      icon: '🎯', description: 'Branded header banner' },
  { type: 'text',    label: 'Text',        icon: '📝', description: 'Rich text content' },
  { type: 'image',   label: 'Image',       icon: '🖼️', description: 'Image with optional link' },
  { type: 'button',  label: 'Button',      icon: '🔘', description: 'Call-to-action button' },
  { type: 'divider', label: 'Divider',     icon: '➖', description: 'Horizontal line separator' },
  { type: 'spacer',  label: 'Spacer',      icon: '↕️', description: 'Empty vertical space' },
  { type: 'social',  label: 'Social Links', icon: '🔗', description: 'Social media icon links' },
]
