import { renderTemplate } from './template-helpers'

export interface WelcomeEmailData {
  clientName: string
  companyName: string
  projectName: string
  portalUrl: string
  teamMembers: Array<{ name: string; role: string; email: string }>
  serviceType: string
}

export function generateWelcomeEmail(data: WelcomeEmailData): string {
  const teamCards = data.teamMembers
    .map(
      (m) => `
      <tr><td style="padding:6px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:40px;vertical-align:top;">
              <div style="width:36px;height:36px;border-radius:50%;background:#015035;color:#ffffff;font-size:14px;font-weight:700;line-height:36px;text-align:center;">${m.name.charAt(0)}</div>
            </td>
            <td style="padding-left:12px;vertical-align:top;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#1f2937;">${m.name}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${m.role} &middot; ${m.email}</p>
            </td>
          </tr>
        </table>
      </td></tr>`,
    )
    .join('')

  const nextSteps = [
    'Review your project scope and timeline',
    'Log in to your client portal',
    'Complete the onboarding questionnaire',
    'Schedule your strategy kickoff call',
  ]
    .map(
      (s) =>
        `<tr><td style="padding:4px 0;font-size:14px;color:#374151;">
        <span style="color:#015035;font-weight:700;margin-right:8px;">&#10003;</span>${s}
      </td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="background:#015035;padding:40px 32px;text-align:center;">
  <img src="https://app.gravissmarketing.com/logo-white.png" alt="Graviss Marketing" style="height:32px;margin-bottom:20px;" />
  <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Welcome, {client_name}!</h1>
  <p style="margin:8px 0 0;font-size:14px;color:#a7f3d0;">We are excited to begin work on {project_name}</p>
</td></tr>

<!-- Body -->
<tr><td style="background:#ffffff;padding:32px;">

  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">Thank you for choosing <strong>{company_name}</strong> for your {service_type} project. Here is what you can expect over the coming weeks:</p>

  <!-- Timeline -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr><td style="padding:12px 16px;background:#f0fdf4;border-radius:8px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">What to Expect</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Week 1:</strong> Onboarding &amp; discovery</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Week 2-3:</strong> Strategy &amp; initial deliverables</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;"><strong style="color:#015035;">Week 4+:</strong> Ongoing execution &amp; reporting</td></tr>
      </table>
    </td></tr>
  </table>

  <!-- Portal CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr><td align="center">
      <a href="{portal_url}" target="_blank" style="display:inline-block;background:#015035;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">Log In to Your Portal</a>
    </td></tr>
  </table>

  <!-- Team -->
  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Your Team</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    ${teamCards}
  </table>

  <!-- Next Steps -->
  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Next Steps</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${nextSteps}
  </table>

</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; {company_name} &middot; All rights reserved</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  return renderTemplate(html, {
    client_name: data.clientName,
    company_name: data.companyName,
    project_name: data.projectName,
    portal_url: data.portalUrl,
    service_type: data.serviceType,
  })
}
