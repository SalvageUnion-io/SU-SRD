/** The sign-in's cryptography, on WebCrypto alone: hashes and the OAuth cookie's encoding. */

const encoder = new TextEncoder()

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * A test account's password, stretched (PBKDF2-SHA-256, salted with its
 * email, so the same pair always hashes alike), as hex. Workers cap PBKDF2 at
 * 100 000 iterations.
 */
export async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100_000 },
    key,
    256
  )
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const base64urlJson = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)))
