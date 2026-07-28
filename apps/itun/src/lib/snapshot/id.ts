/**
 * Short ID generation for snapshot keys.
 *
 * Uses Crockford base32 (0-9 + A-Z minus I, L, O, U) for ~40 bits of entropy
 * in 8 characters. See ADR-004-snapshot-netlify-functions.md §ID Scheme.
 */

// Crockford base32 alphabet — unambiguous alphanumeric characters
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ID_LENGTH = 8
const MAX_RETRIES = 5

/**
 * Matches a well-formed snapshot ID: exactly 8 uppercase Crockford-base32
 * characters (0-9, A-Z minus I, L, O, U). Used to reject malformed IDs before
 * they reach the blob store — a cheap input-validation guard (CWE-20).
 */
export const SNAPSHOT_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8}$/

/** True when `id` is a syntactically valid snapshot ID. */
export function isValidSnapshotId(id: string): boolean {
  return SNAPSHOT_ID_PATTERN.test(id)
}

/**
 * Generates a random 8-character base32 ID.
 * Uses crypto.getRandomValues for cryptographic randomness.
 */
function generateId(): string {
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
 * Generic in its collision check, so it also backs Game invite codes
 * (convex/invites.ts) — Crockford base32 with no I/L/O/U means a code read
 * aloud across a table cannot be mistyped into a different valid one.
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
  throw new Error('Failed to generate a unique short ID after max retries')
}
