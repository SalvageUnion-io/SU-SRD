/**
 * Short ID generation for snapshot keys.
 *
 * Uses Crockford base32 (0-9 + A-Z minus I, L, O, U) for ~40 bits of entropy
 * in 8 characters. See ADR-010-snapshot-backend.md §ID Scheme.
 */

// Crockford base32 alphabet — unambiguous alphanumeric characters
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ID_LENGTH = 8
const MAX_RETRIES = 5

/**
 * Generates a random 8-character base32 ID.
 * Uses crypto.getRandomValues for cryptographic randomness.
 */
export function generateId(): string {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('')
}

/**
 * Generates a unique ID that does not already exist in the given store.
 * Retries up to MAX_RETRIES times on collision.
 *
 * @throws {Error} if all retry attempts collide (extremely unlikely at scale)
 */
export async function generateUniqueId(exists: (id: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const id = generateId()
    if (!(await exists(id))) {
      return id
    }
  }
  throw new Error('Failed to generate a unique snapshot ID after max retries')
}
