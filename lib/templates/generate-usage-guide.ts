import { renderTemplate } from './template-helpers'

export interface UsageGuideEmailData {
  clientName: string
  serviceType: string
  guideUrl: string
  helpCenterUrl: string
}

const SERVICE_STEPS: Record<string, string[]> = {
  Website: [
    'Log in to your client portal to view project progress',
    'Review deliverables as they are uploaded to your dashboard',
    'Submit feedback directly through the portal comment system',
    'Track milestones and upcoming deadlines on the timeline view',
  ],
  SEO: [
    'View your keyword rankings in the Rank Tracker dashboard',
    'Check monthly traffic reports under the Analytics tab',
    'Review content recommendations in the Strategy section',
    'Monitor your Google Business Profile metrics',
  ],
  'Social Media': [
    'Review and approve scheduled posts in the Content Calendar',
    'View engagement metrics on the Social Analytics dashboard',
    'Submit content ideas through the portal request form',
    'Track audience growth in the monthly summary report',
  ],
  Default: [
    'Log in to your client portal to view project updates',
    'Review deliverables and reports as they become available',
    'Submit requests or feedback through the portal',
    'Check your dashboard for key metrics and progress',
  ],
}

export function generateUsageGuideEmail(data: UsageGuideEmailData): string {
  const steps = SERVICE_STEPS[data.serviceType] ?? SERVICE_STEPS.Default
  const stepsHtml = steps
    .map(
      (step, i) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:32px;vertical-align:top;">
            <div style="width:28px;height:28px;border-radius:50%;background:#015035;color:#ffffff;font-size:13px;font-weight:700;line-height:28px;text-align:center;font-family:'Montserrat',sans-serif;">${i + 1}</div>
          </td>
          <td style="padding-left:12px;font-size:14px;line-height:1.5;color:#1B211D;vertical-align:middle;font-family:'Montserrat',sans-serif;">${step}</td>
        </tr>
      </table>
    </td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:#012b1e;padding:32px;text-align:center;">
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">GRAVISS MARKETING</h1>
  <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">PORTAL GUIDE</p>
  <p style="margin:10px 0 0;font-size:14px;color:#FFF3EA;font-family:'Montserrat',sans-serif;">Your {service_type} Portal Guide</p>
</td></tr>

<!-- Body -->
<tr><td style="background:#ffffff;padding:32px;">

  <h2 style="margin:0 0 8px;color:#1B211D;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">Hi {client_name},</h2>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1B211D;font-family:'Montserrat',sans-serif;">Here is a quick guide on how to get the most out of your portal and stay up to date on your {service_type} project.</p>

  <!-- Section: Getting Started -->
  <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Getting Started</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    ${stepsHtml}
  </table>

  <!-- Section: Resources -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF3EA;border-radius:8px;padding:0;margin-bottom:24px;">
    <tr><td style="padding:20px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Helpful Resources</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1B211D;font-family:'Montserrat',sans-serif;">
        <a href="{guide_url}" style="color:#015035;font-weight:600;text-decoration:underline;">Full Usage Guide</a> - step-by-step walkthrough with screenshots
      </p>
      <p style="margin:0;font-size:14px;color:#1B211D;font-family:'Montserrat',sans-serif;">
        <a href="{help_center_url}" style="color:#015035;font-weight:600;text-decoration:underline;">Help Center</a> - FAQs, tutorials, and support contact
      </p>
    </td></tr>
  </table>

  <!-- CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <a href="{guide_url}" target="_blank" style="display:inline-block;background:#015035;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;font-family:'Montserrat',sans-serif;">View Full Guide</a>
    </td></tr>
  </table>

</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#8C8478;font-family:'Montserrat',sans-serif;">Questions? Reply to this email or visit our <a href="{help_center_url}" style="color:#015035;">Help Center</a>.</p>
  <p style="margin:4px 0 0;font-size:11px;color:#8C8478;font-family:'Montserrat',sans-serif;">&copy; ${new Date().getFullYear()} Graviss Marketing</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  return renderTemplate(html, {
    client_name: data.clientName,
    service_type: data.serviceType,
    guide_url: data.guideUrl,
    help_center_url: data.helpCenterUrl,
  })
}
