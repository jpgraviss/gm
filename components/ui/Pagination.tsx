'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}

function getVisiblePages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | 'ellipsis')[] = []

  if (current <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i)
    pages.push('ellipsis', total)
  } else if (current >= total - 2) {
    pages.push(1, 'ellipsis')
    for (let i = total - 3; i <= total; i++) pages.push(i)
  } else {
    pages.push(1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total)
  }

  return pages
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, -1],
}: Props) {
  const effectivePageSize = pageSize <= 0 ? totalItems : pageSize
  const start = (currentPage - 1) * effectivePageSize + 1
  const end = Math.min(currentPage * effectivePageSize, totalItems)

  if (totalItems === 0) return null

  const pages = getVisiblePages(currentPage, totalPages)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{start}</span>
        {' '}&ndash;{' '}
        <span className="font-medium text-gray-700">{end}</span>
        {' '}of{' '}
        <span className="font-medium text-gray-700">{totalItems}</span>
      </p>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size <= 0 ? 'All' : `${size} / page`}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
        >
          <ChevronLeft size={13} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {pages.map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400 select-none">&hellip;</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[30px] h-[30px] text-xs font-medium rounded-lg transition-colors ${
                page === currentPage
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
              style={page === currentPage ? { background: '#015035' } : {}}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
