import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'

// AUDIT.md #207 — real email-based 2FA for staff sign-in, gated on
// Security Settings' "Two-Factor Auth" being set to Required. "Optional"
// has no per-user opt-in column/UI to honor (this pass didn't build a
// self-service enroll/disable flow) and is treated as not-enforced, same
// as "Disabled" — only the org-wide "Required" tier is real.
const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function sendTwoFactorCode(memberId: string, email: string, name: string): Promise<void> {
  const db = createServiceClient()
  const code = generateCode()
  const expires = new Date(Date.now() + CODE_TTL_MS).toISOString()

  await db.from('team_members').update({
    two_factor_code: code,
    two_factor_code_expires: expires,
  }).eq('id', memberId)

  const settings = await getSettings()
  await sendEmail({
    to: email,
    subject: `${settings.company.name} sign-in code: ${code}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#012b1e;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">SIGN-IN VERIFICATION</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;text-align:center;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:700;">Hi ${name.split(' ')[0]},</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">Enter this code to finish signing in:</p>
            <div style="display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 32px;margin-bottom:24px;">
              <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#012b1e;">${code}</span>
            </div>
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
              This code expires in 10 minutes. If you didn't try to sign in, you can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

export async function verifyTwoFactorCode(memberId: string, code: string): Promise<boolean> {
  const db = createServiceClient()
  const { data: member } = await db
    .from('team_members')
    .select('two_factor_code, two_factor_code_expires')
    .eq('id', memberId)
    .maybeSingle()

  if (!member?.two_factor_code) return false
  if (member.two_factor_code_expires && new Date(member.two_factor_code_expires) < new Date()) return false
  if (member.two_factor_code !== code.trim()) return false

  await db.from('team_members').update({
    two_factor_code: null,
    two_factor_code_expires: null,
  }).eq('id', memberId)

  return true
}
