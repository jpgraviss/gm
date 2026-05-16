'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, Image, Loader2 } from 'lucide-react'

const MAX_SIZE = 10 * 1024 * 1024

interface UploadedFile {
  name: string
  size: number
  url: string
  path: string
  type: string
}

interface Props {
  accept?: string
  maxSize?: number
  company: string
  onUpload?: (file: UploadedFile) => void
  onRemove?: (file: UploadedFile) => void
  files?: UploadedFile[]
  multiple?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function isImage(type: string): boolean {
  return type.startsWith('image/')
}

export default function FileUpload({
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv',
  maxSize = MAX_SIZE,
  company,
  onUpload,
  onRemove,
  files = [],
  multiple = true,
}: Props) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setError(null)

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      if (file.size > maxSize) {
        setError(`"${file.name}" exceeds ${formatBytes(maxSize)} limit.`)
        continue
      }

      setUploading(true)
      setProgress(0)

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('company', company)

        const res = await fetch('/api/files', { method: 'POST', body: formData })

        clearInterval(progressInterval)

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Upload failed' }))
          setError(data.error || 'Upload failed')
          continue
        }

        setProgress(100)
        const data = await res.json()
        onUpload?.({ name: data.name, size: file.size, url: data.url, path: data.path, type: file.type })
      } catch {
        clearInterval(progressInterval)
        setError('Upload failed. Please try again.')
      } finally {
        setUploading(false)
        setProgress(0)
      }
    }
  }, [company, maxSize, onUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="text-emerald-600 animate-spin" />
            <p className="text-sm text-gray-600">Uploading...</p>
            <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${progress}%`, background: '#015035' }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-gray-400" />
            <p className="text-sm text-gray-600">
              Drag & drop files here or <span className="text-emerald-700 font-semibold">browse</span>
            </p>
            <p className="text-xs text-gray-400">
              Images, PDFs, documents up to {formatBytes(maxSize)}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <X size={12} /> {error}
        </p>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-xl">
              {isImage(file.type) && file.url ? (
                <img src={file.url} alt={file.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {file.type === 'application/pdf' ? (
                    <FileText size={16} className="text-red-500" />
                  ) : isImage(file.type) ? (
                    <Image size={16} className="text-blue-500" />
                  ) : (
                    <FileText size={16} className="text-gray-400" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
              </div>
              {onRemove && (
                <button
                  onClick={e => { e.stopPropagation(); onRemove(file) }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"
                >
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
