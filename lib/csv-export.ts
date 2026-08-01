'use client'

interface CsvColumn {
  key: string
  label: string
  format?: (value: unknown) => string
}

// AUDIT #649 — a cell starting with =/+/-/@/tab/CR is treated as a live
// formula by Excel/Google Sheets when the CSV is opened (e.g.
// `=HYPERLINK(...)`). Prefixing with a leading `'` is the standard
// mitigation — it forces the cell to render as text in every spreadsheet
// app while leaving the underlying value (visually) unchanged.
function escapeCell(value: unknown): string {
  if (value == null) return ''
  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
  filename: string,
) {
  const header = columns.map(c => escapeCell(c.label)).join(',')
  const body = rows.map(row =>
    columns.map(c => {
      const val = row[c.key]
      return escapeCell(c.format ? c.format(val) : val)
    }).join(',')
  ).join('\n')

  const bom = '﻿'
  const blob = new Blob([bom + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
