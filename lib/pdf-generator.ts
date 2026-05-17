import jsPDF from 'jspdf'

interface PdfOptions {
  title?: string
  filename?: string
  orientation?: 'portrait' | 'landscape'
  margins?: { top: number; right: number; bottom: number; left: number }
}

const DEFAULT_MARGINS = { top: 20, right: 15, bottom: 20, left: 15 }

export function generatePdf(html: string, options: PdfOptions = {}): Blob {
  const {
    title,
    orientation = 'portrait',
    margins = DEFAULT_MARGINS,
  } = options

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  })

  if (title) {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margins.left, margins.top)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), margins.left, margins.top + 8)
  }

  const startY = title ? margins.top + 16 : margins.top
  const pageWidth = orientation === 'portrait' ? 210 : 297
  const maxWidth = pageWidth - margins.left - margins.right

  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  - ')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<td[^>]*>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;/g, '->')
    .replace(/&copy;/g, '(c)')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  doc.setFontSize(10)
  const lines = doc.splitTextToSize(stripped, maxWidth)
  const lineHeight = 4.5
  let y = startY
  const pageHeight = orientation === 'portrait' ? 297 : 210

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margins.bottom) {
      doc.addPage()
      y = margins.top
    }
    doc.text(line, margins.left, y)
    y += lineHeight
  }

  return doc.output('blob')
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
