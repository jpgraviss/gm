'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { generatePdf, downloadPdf } from '@/lib/pdf-generator'

interface Props {
  url: string
  filename: string
  label?: string
  title?: string
  orientation?: 'portrait' | 'landscape'
  className?: string
}

export default function PdfDownloadButton({
  url,
  filename,
  label = 'Download PDF',
  title,
  orientation = 'portrait',
  className,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch content')
      const data = await res.json()
      const html = data.html ?? ''
      if (!html) throw new Error('No HTML content returned')
      const blob = generatePdf(html, { title, filename, orientation })
      downloadPdf(blob, filename)
    } catch (err) {
      console.error('PDF download failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
        className ?? 'bg-[#015035] text-white'
      }`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {label}
    </button>
  )
}
