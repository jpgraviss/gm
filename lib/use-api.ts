'use client'

import useSWR, { SWRConfiguration } from 'swr'

const MAX_RETRIES = 3
const RETRY_BASE_MS = 1000

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

async function apiFetcher<T>(url: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (attempt < MAX_RETRIES && isRetryable(res.status)) {
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
          continue
        }
        throw new Error(`API error ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
        continue
      }
    }
  }
  throw lastError
}

export function useApi<T = unknown[]>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, apiFetcher<T>, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    ...config,
  })
}
