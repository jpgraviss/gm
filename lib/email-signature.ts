export interface EmailSignatureData {
  name: string
  title: string
  email: string
  phone: string
  website: string
  linkedIn: string
  photoUrl: string
}

export const DEFAULT_SIGNATURE: EmailSignatureData = {
  name: '',
  title: '',
  email: '',
  phone: '',
  website: 'gravissmarketing.com',
  linkedIn: '',
  photoUrl: '',
}

export function generateSignatureHtml(sig: EmailSignatureData): string {
  const FOREST = '#015035'
  const CREAM = '#FFF3EA'
  const TERRACOTTA = '#CC7853'
  const INK = '#1B211D'
  const STONE = '#8C8478'

  const logoUrl = 'https://hufztrajgtyuzsgopzyi.supabase.co/storage/v1/object/public/assets/graviss-logo.png'

  const phoneLine = sig.phone
    ? `<tr><td style="padding:2px 0;font-size:13px;color:${STONE};font-family:'Montserrat',Arial,sans-serif;">
        <span style="color:${TERRACOTTA};font-weight:600;">P</span>&nbsp;
        <a href="tel:${sig.phone.replace(/[^\d+]/g, '')}" style="color:${INK};text-decoration:none;">${sig.phone}</a>
      </td></tr>`
    : ''

  const emailLine = sig.email
    ? `<tr><td style="padding:2px 0;font-size:13px;color:${STONE};font-family:'Montserrat',Arial,sans-serif;">
        <span style="color:${TERRACOTTA};font-weight:600;">E</span>&nbsp;
        <a href="mailto:${sig.email}" style="color:${INK};text-decoration:none;">${sig.email}</a>
      </td></tr>`
    : ''

  const websiteLine = sig.website
    ? `<tr><td style="padding:2px 0;font-size:13px;color:${STONE};font-family:'Montserrat',Arial,sans-serif;">
        <span style="color:${TERRACOTTA};font-weight:600;">W</span>&nbsp;
        <a href="https://${sig.website.replace(/^https?:\/\//, '')}" style="color:${INK};text-decoration:none;">${sig.website.replace(/^https?:\/\//, '')}</a>
      </td></tr>`
    : ''

  const linkedInLine = sig.linkedIn
    ? `<tr><td style="padding:2px 0;font-size:13px;color:${STONE};font-family:'Montserrat',Arial,sans-serif;">
        <a href="${sig.linkedIn.startsWith('http') ? sig.linkedIn : `https://linkedin.com/in/${sig.linkedIn}`}" style="color:${INK};text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="14" height="14" style="vertical-align:middle;margin-right:4px;" alt="LinkedIn" />LinkedIn
        </a>
      </td></tr>`
    : ''

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Montserrat',Arial,sans-serif;max-width:480px;">
  <tr>
    <td style="padding:16px 0 12px 0;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-top:3px solid ${FOREST};padding-top:14px;">
        <tr>
          ${sig.photoUrl ? `<td style="vertical-align:top;padding-right:14px;">
            <img src="${sig.photoUrl}" width="72" height="72" style="border-radius:8px;object-fit:cover;" alt="${sig.name}" />
          </td>` : ''}
          <td style="vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr><td style="font-size:16px;font-weight:700;color:${FOREST};padding-bottom:2px;font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.3px;">${sig.name || 'Your Name'}</td></tr>
              ${sig.title ? `<tr><td style="font-size:13px;font-weight:500;color:${TERRACOTTA};padding-bottom:8px;font-family:'Montserrat',Arial,sans-serif;">${sig.title}</td></tr>` : ''}
              ${phoneLine}
              ${emailLine}
              ${websiteLine}
              ${linkedInLine}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};border-radius:8px;padding:10px 14px;">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${logoUrl}" width="36" height="36" style="display:block;" alt="Graviss Marketing" />
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:14px;font-weight:700;color:${FOREST};font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.5px;">Graviss Marketing</span><br/>
            <span style="font-size:11px;color:${STONE};font-family:'Montserrat',Arial,sans-serif;">Digital Marketing &amp; Web Solutions</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}
