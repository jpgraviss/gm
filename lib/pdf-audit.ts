import {
  PAGE, PDF_COLORS, drawHeaderBand, drawSectionTitle, drawFooterOnAllPages,
  drawScoreBadge, gradeColorRgb, checkPageBreak, type PdfCursor,
} from '@/lib/pdf-brand'

export interface AuditSectionResult {
  name: string
  score: number
  grade: string
  findings: string[]
  recommendations: string[]
}

export interface AuditPdfData {
  website_url: string
  company_name?: string
  audit_type: string
  overall_score: number
  overall_grade: string
  summary: string
  sections: AuditSectionResult[]
  created_at: string
}

function wrapText(pdf: import('jspdf').default, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth)
}

export async function generateAuditPdf(audit: AuditPdfData): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const { marginLeft, contentWidth } = PAGE
  const sections = Array.isArray(audit.sections) ? audit.sections : []
  const dateStr = new Date(audit.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const auditTypeLabel = audit.audit_type === 'full' ? 'Full Audit' : audit.audit_type === 'seo' ? 'SEO Audit' : 'Website Audit'

  const cursor: PdfCursor = {
    y: drawHeaderBand(pdf, {
      eyebrow: auditTypeLabel,
      title: audit.company_name || audit.website_url,
      subtitle: audit.website_url,
    }),
  }

  // ── Overview: score badge + grade + meta ─────────────────────────────
  checkPageBreak(pdf, cursor, 30)
  const badgeX = marginLeft + 12
  const badgeY = cursor.y + 10
  drawScoreBadge(pdf, badgeX, badgeY, 12, audit.overall_score, audit.overall_grade)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...gradeColorRgb(audit.overall_grade))
  pdf.text(`Grade ${audit.overall_grade}`, badgeX + 20, badgeY - 2)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...PDF_COLORS.gray)
  pdf.text(`Overall Score · ${dateStr}`, badgeX + 20, badgeY + 4)
  cursor.y += 28

  // ── Executive Summary ─────────────────────────────────────────────────
  if (audit.summary) {
    drawSectionTitle(pdf, cursor, 'Executive Summary')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.setTextColor(...PDF_COLORS.ink)
    const lines = wrapText(pdf, audit.summary, contentWidth)
    for (const line of lines) {
      checkPageBreak(pdf, cursor, 6)
      pdf.text(line, marginLeft, cursor.y)
      cursor.y += 5
    }
    cursor.y += 6
  }

  // ── Section Scores overview ────────────────────────────────────────────
  if (sections.length > 0) {
    drawSectionTitle(pdf, cursor, 'Section Scores')
    for (const s of sections) {
      checkPageBreak(pdf, cursor, 8)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...PDF_COLORS.ink)
      pdf.text(s.name, marginLeft, cursor.y)

      const barX = marginLeft + 60
      const barWidth = contentWidth - 60 - 22
      pdf.setFillColor(...PDF_COLORS.border)
      pdf.roundedRect(barX, cursor.y - 3, barWidth, 3, 1, 1, 'F')
      pdf.setFillColor(...gradeColorRgb(s.grade))
      pdf.roundedRect(barX, cursor.y - 3, barWidth * Math.max(0.03, s.score / 100), 3, 1, 1, 'F')

      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...gradeColorRgb(s.grade))
      pdf.text(`${s.grade} (${s.score})`, marginLeft + contentWidth, cursor.y, { align: 'right' })
      cursor.y += 7
    }
    cursor.y += 6
  }

  // ── Detailed sections ───────────────────────────────────────────────
  for (const section of sections) {
    checkPageBreak(pdf, cursor, 20)
    drawSectionTitle(pdf, cursor, section.name)

    // Score chip
    pdf.setFillColor(...gradeColorRgb(section.grade))
    pdf.roundedRect(marginLeft, cursor.y - 8, 34, 7, 1.5, 1.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...PDF_COLORS.white)
    pdf.text(`${section.grade} · ${section.score}/100`, marginLeft + 17, cursor.y - 3.3, { align: 'center' })
    cursor.y += 4

    if (section.findings?.length > 0) {
      checkPageBreak(pdf, cursor, 10)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...PDF_COLORS.stone)
      pdf.text('FINDINGS', marginLeft, cursor.y)
      cursor.y += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      for (const finding of section.findings) {
        const lines = wrapText(pdf, finding, contentWidth - 5)
        checkPageBreak(pdf, cursor, lines.length * 4.5 + 2)
        pdf.setTextColor(...hexToAmber())
        pdf.text('!', marginLeft, cursor.y)
        pdf.setTextColor(...PDF_COLORS.ink)
        for (const [i, line] of lines.entries()) {
          pdf.text(line, marginLeft + 5, cursor.y + i * 4.5)
        }
        cursor.y += lines.length * 4.5 + 1.5
      }
      cursor.y += 3
    }

    if (section.recommendations?.length > 0) {
      checkPageBreak(pdf, cursor, 10)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...PDF_COLORS.stone)
      pdf.text('RECOMMENDATIONS', marginLeft, cursor.y)
      cursor.y += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      for (const rec of section.recommendations) {
        const lines = wrapText(pdf, rec, contentWidth - 5)
        checkPageBreak(pdf, cursor, lines.length * 4.5 + 2)
        pdf.setTextColor(...PDF_COLORS.primary)
        pdf.text('+', marginLeft, cursor.y)
        pdf.setTextColor(...PDF_COLORS.ink)
        for (const [i, line] of lines.entries()) {
          pdf.text(line, marginLeft + 5, cursor.y + i * 4.5)
        }
        cursor.y += lines.length * 4.5 + 1.5
      }
    }
    cursor.y += 8
  }

  drawFooterOnAllPages(pdf, { label: 'Website & SEO Audit' })

  return pdf.output('blob')
}

// Amber (#d97706) isn't in the shared palette (it's grade-D specific there) —
// findings use it consistently as a caution/observation marker.
function hexToAmber(): [number, number, number] {
  return [217, 119, 6]
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
