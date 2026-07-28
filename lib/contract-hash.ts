import crypto from 'crypto'

// AUDIT.md #497 — single source of truth for the SHA-256 "document hash"
// stored on signature_requests.document_hash. It's computed once when a
// signature request is created (app/api/signatures/route.ts POST) and must
// be recomputed with this exact same field set/shape at signing time
// (app/api/signatures/[token]/route.ts PATCH) to detect a contract edited
// after the sign link went out — any drift in field selection or JSON shape
// between the two call sites would make every hash spuriously "differ."
export interface ContractHashFields {
  company: string | null
  value: number | null
  service_type: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any
  notes: string | null
  start_date: string | null
  end_date: string | null
}

export function computeContractDocumentHash(contract: ContractHashFields): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    company: contract.company,
    value: contract.value,
    service_type: contract.service_type,
    items: contract.items,
    notes: contract.notes,
    start_date: contract.start_date,
    end_date: contract.end_date,
  })).digest('hex')
}
