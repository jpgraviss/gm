import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    // If no encryption key is set, return a deterministic fallback so the app
    // still works in development. In production, set TOKEN_ENCRYPTION_KEY.
    console.warn('[encryption] TOKEN_ENCRYPTION_KEY not set — using insecure fallback')
    return crypto.createHash('sha256').update('gravhub-dev-key').digest()
  }
  return crypto.createHash('sha256').update(key).digest()
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decrypt(ciphertext: string): string {
  // If the value doesn't look encrypted (no colons), return as-is
  // This handles legacy unencrypted tokens gracefully
  if (!ciphertext.includes(':')) return ciphertext

  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) return ciphertext // Not our format

  try {
    const iv = Buffer.from(parts[0], 'base64')
    const tag = Buffer.from(parts[1], 'base64')
    const encrypted = Buffer.from(parts[2], 'base64')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch {
    // If decryption fails, the token might be stored unencrypted (legacy)
    return ciphertext
  }
}
