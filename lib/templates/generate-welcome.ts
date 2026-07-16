import { renderTemplate } from './template-helpers'

export interface WelcomeEmailData {
  firstName: string
  companyName: string
  portalUrl: string
  email?: string
  accountManager?: { name: string; email: string; phone: string }
  projectName?: string
  serviceType?: string
}

export function generateWelcomeEmail(data: WelcomeEmailData): string {
  // The default footer previously linked to {portal_url}/unsubscribe — a
  // bare path with no matching route (only /unsubscribe/[token] exists,
  // and nothing ever generates that token for this flow), so this was the
  // one 404ing link real portal-welcome recipients got. Point at the
  // mechanism actually checked elsewhere (sequence_suppression_list) —
  // same one broadcasts/sequences already use — instead of building out
  // the separate, currently-orphaned token-based unsubscribe page.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  const unsubscribeUrl = data.email
    ? `${appUrl}/api/sequences/unsubscribe?email=${encodeURIComponent(data.email)}`
    : `${data.portalUrl}/unsubscribe`
  const managerSection = data.accountManager
    ? `<tr><td style="padding:0 32px 32px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Your Account Manager</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
          <tr><td style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:44px;vertical-align:top;">
                  <div style="width:40px;height:40px;border-radius:50%;background:#015035;color:#ffffff;font-size:16px;font-weight:700;line-height:40px;text-align:center;">${data.accountManager.name.charAt(0)}</div>
                </td>
                <td style="padding-left:14px;vertical-align:top;">
                  <p style="margin:0;font-size:15px;font-weight:600;color:#1f2937;">${data.accountManager.name}</p>
                  <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">${data.accountManager.email}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${data.accountManager.phone}</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;">

<tr><td style="background:#012b1e;padding:40px 32px;text-align:center;">
  <img src="https://app.gravissmarketing.com/logo-white.png" alt="Graviss Marketing" style="height:32px;margin-bottom:20px;" />
  <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;font-family:'Syncopate',sans-serif;letter-spacing:0.06em;">WELCOME TO GRAVISS MARKETING</h1>
</td></tr>

<tr><td style="background:#ffffff;padding:32px 32px 0;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#374151;">Hi {first_name},</p>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">We're excited to have <strong>{company_name}</strong> on board! Your client portal is ready, giving you full visibility into your projects and deliverables.</p>
</td></tr>

<tr><td style="background:#ffffff;padding:0 32px 24px;">
  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Your Client Portal</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;margin-bottom:8px;">
    <tr><td style="padding:16px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;"><span style="color:#015035;font-weight:700;margin-right:8px;">&#10003;</span>View project progress and milestones</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;"><span style="color:#015035;font-weight:700;margin-right:8px;">&#10003;</span>Download reports and deliverables</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;"><span style="color:#015035;font-weight:700;margin-right:8px;">&#10003;</span>Submit support tickets and requests</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;"><span style="color:#015035;font-weight:700;margin-right:8px;">&#10003;</span>Review invoices and contracts</td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>

<tr><td style="background:#ffffff;padding:0 32px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <a href="{portal_url}" target="_blank" style="display:inline-block;background:#015035;color:#ffffff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;font-family:'Montserrat',sans-serif;">Log In to Your Portal</a>
    </td></tr>
  </table>
</td></tr>

${managerSection}

<tr><td style="background:#ffffff;padding:0 32px 32px;">
  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">What Happens Next</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr><td style="padding:16px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Week 1:</strong> Discovery &amp; onboarding kickoff</td></tr>
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Week 2:</strong> Strategy development &amp; planning</td></tr>
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Week 3:</strong> Setup &amp; initial build</td></tr>
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Week 4:</strong> Launch &amp; optimization begins</td></tr>
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Ongoing:</strong> Monthly reporting &amp; continuous improvement</td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>

<tr><td style="background:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:600;">Graviss Marketing</p>
  <p style="margin:0 0 12px;font-size:12px;color:#9ca3af;">info@gravissmarketing.com &middot; +1 (830) 326-0320</p>
  <p style="margin:0 0 12px;">
    <a href="https://facebook.com/gravissmarketing" style="color:#9ca3af;text-decoration:none;margin:0 6px;font-size:12px;">Facebook</a>
    <a href="https://instagram.com/gravissmarketing" style="color:#9ca3af;text-decoration:none;margin:0 6px;font-size:12px;">Instagram</a>
    <a href="https://linkedin.com/company/gravissmarketing" style="color:#9ca3af;text-decoration:none;margin:0 6px;font-size:12px;">LinkedIn</a>
  </p>
  <p style="margin:0;font-size:11px;color:#d1d5db;">&copy; ${new Date().getFullYear()} Graviss Marketing &middot; <a href="{unsubscribe_url}" style="color:#d1d5db;">Unsubscribe</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  return renderTemplate(html, {
    first_name: data.firstName,
    company_name: data.companyName,
    portal_url: data.portalUrl,
    unsubscribe_url: unsubscribeUrl,
  })
}
