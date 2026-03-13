import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set the env var before importing
process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-for-vitest'

import { encrypt, decrypt } from '@/lib/encryption'

describe('encryption', () => {
  it('encrypts and decrypts back to original', () => {
    const original = 'ya29.a0AfH6SMC-example-access-token'
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toContain(':') // iv:tag:ciphertext format
    expect(decrypt(encrypted)).toBe(original)
  })

  it('produces different ciphertext for same input (random IV)', () => {
    const original = 'some-token-value'
    const encrypted1 = encrypt(original)
    const encrypted2 = encrypt(original)
    expect(encrypted1).not.toBe(encrypted2)
    // Both decrypt to the same value
    expect(decrypt(encrypted1)).toBe(original)
    expect(decrypt(encrypted2)).toBe(original)
  })

  it('returns unencrypted strings as-is (legacy compatibility)', () => {
    const plainToken = 'ya29.legacy-plain-token-no-colons'
    expect(decrypt(plainToken)).toBe(plainToken)
  })

  it('handles empty strings', () => {
    const encrypted = encrypt('')
    expect(decrypt(encrypted)).toBe('')
  })

  it('handles long tokens', () => {
    const longToken = 'a'.repeat(2000)
    const encrypted = encrypt(longToken)
    expect(decrypt(encrypted)).toBe(longToken)
  })
})
