'use client'

import { useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { type EmailBlock, renderEmailHTML } from '@/lib/email-builder'

interface Props {
  blocks: EmailBlock[]
  subject?: string
  preheader?: string
}

export default function EmailPreview({ blocks, subject, preheader }: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')

  const html = renderEmailHTML(blocks, { preheader })

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded-lg transition-colors ${device === 'desktop' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-200'}`}
            title="Desktop preview"
          >
            <Monitor size={14} />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded-lg transition-colors ${device === 'mobile' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-200'}`}
            title="Mobile preview"
          >
            <Smartphone size={14} />
          </button>
        </div>
        {subject && (
          <p className="text-[11px] text-gray-500 truncate ml-3 flex-1">
            Subject: <span className="font-semibold text-gray-700">{subject}</span>
          </p>
        )}
      </div>

      {/* Preview frame */}
      <div className="flex-1 overflow-auto bg-gray-100 flex justify-center p-4">
        <div
          className="bg-white shadow-sm transition-all duration-300"
          style={{
            width: device === 'mobile' ? 375 : 650,
            minHeight: 400,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {blocks.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-gray-400 text-sm">
              Add blocks to see your email preview
            </div>
          ) : (
            <iframe
              srcDoc={html}
              title="Email preview"
              style={{
                width: '100%',
                height: '100%',
                minHeight: 500,
                border: 'none',
              }}
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  )
}
