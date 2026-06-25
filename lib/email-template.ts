import { getSettings, type AppSettings } from '@/lib/settings'

export async function wrapBrandedEmail(body: string, subtitle?: string): Promise<string> {
  const settings = await getSettings()
  return brandedEmailWrapper(body, settings, subtitle)
}

export function brandedEmailWrapper(body: string, settings: AppSettings, subtitle?: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${settings.branding.darkBg};padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()}</h1>
            ${subtitle ? `<p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-family:'Syncopate',sans-serif;">${subtitle}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <div style="color:#374151;font-size:15px;line-height:1.7;">${body}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} ${settings.company.name} &nbsp;&middot;&nbsp;
              <a href="mailto:${settings.email.supportEmail}" style="color:${settings.branding.primaryColor};">${settings.email.supportEmail}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
