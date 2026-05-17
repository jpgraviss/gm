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
            <div style="width:28px;height:28px;border-radius:50%;background:#015035;color:#ffffff;font-size:13px;font-weight:700;line-height:28px;text-align:center;">${i + 1}</div>
          </td>
          <td style="padding-left:12px;font-size:14px;line-height:1.5;color:#374151;vertical-align:middle;">${step}</td>
        </tr>
      </table>
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
<tr><td style="background:#015035;padding:32px;text-align:center;">
  <img src="https://app.gravissmarketing.com/logo-white.png" alt="Graviss Marketing" style="height:32px;margin-bottom:16px;" />
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Your {service_type} Portal Guide</h1>
</td></tr>

<!-- Body -->
<tr><td style="background:#ffffff;padding:32px;">

  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">Hi {client_name}, here is a quick guide on how to get the most out of your portal and stay up to date on your {service_type} project.</p>

  <!-- Section: Getting Started -->
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Getting Started</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    ${stepsHtml}
  </table>

  <!-- Section: Resources -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;padding:0;margin-bottom:24px;">
    <tr><td style="padding:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Helpful Resources</p>
      <p style="margin:0 0 6px;font-size:14px;color:#374151;">
        <a href="{guide_url}" style="color:#015035;font-weight:600;text-decoration:underline;">Full Usage Guide</a> &mdash; step-by-step walkthrough with screenshots
      </p>
      <p style="margin:0;font-size:14px;color:#374151;">
        <a href="{help_center_url}" style="color:#015035;font-weight:600;text-decoration:underline;">Help Center</a> &mdash; FAQs, tutorials, and support contact
      </p>
    </td></tr>
  </table>

  <!-- CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <a href="{guide_url}" target="_blank" style="display:inline-block;background:#015035;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">View Full Guide</a>
    </td></tr>
  </table>

</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">Questions? Reply to this email or visit our <a href="{help_center_url}" style="color:#9ca3af;">Help Center</a>.</p>
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
