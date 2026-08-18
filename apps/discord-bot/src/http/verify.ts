/**
 * Ed25519 request verification for Discord HTTP interactions.
 *
 * Discord signs every interaction POST with the application's Ed25519 key and
 * sends `X-Signature-Ed25519` + `X-Signature-Timestamp`. The signed message is
 * `timestamp + rawBody`, concatenated as bytes.
 *
 * ## This is the ONLY thing standing between the endpoint and the internet
 *
 * Unlike the gateway — where Discord authenticates *us* with a bot token over a
 * session we opened — an interactions endpoint is a public URL anyone can POST
 * to. Signature verification is the entire authentication story. A handler that
 * skips it, or that verifies a re-serialised body rather than the exact bytes
 * received, will happily execute forged interactions.
 *
 * So this takes the **raw body text** and never a parsed-then-restringified
 * object: `JSON.parse` followed by `JSON.stringify` does not round-trip
 * byte-for-byte (key order survives, but escaping and number formatting need
 * not), and any difference invalidates an otherwise-good signature — or, worse,
 * invites someone to "fix" it by loosening the check.
 *
 * ## Why WebCrypto rather than a library
 *
 * workerd exposes Ed25519 through `crypto.subtle` natively, so this needs no
 * dependency at all. `discord-interactions`' `verifyKey` would pull in a Node
 * crypto shim for no benefit.
 */

const ENCODER = new TextEncoder()

/**
 * The slice of WebCrypto this file uses, as **workerd** implements it.
 *
 * Declared rather than imported, because this app is typechecked against Node's
 * lib (the gateway half genuinely is Node) while this file runs on workerd. Two
 * mismatches follow, and neither is a real defect:
 *
 *   - `Ed25519` is a first-class workerd algorithm but is not in the DOM lib's
 *     `AlgorithmIdentifier` union, so TS rejects a string it has never heard of.
 *   - TypeScript 5.7 made `Uint8Array` generic over its buffer, which no longer
 *     matches the older `BufferSource` those signatures declare.
 *
 * The alternative — adding `@cloudflare/workers-types` to this app — would put
 * two competing definitions of `fetch`, `Request` and `Response` into one
 * program. One narrow structural declaration is the smaller lie, and it states
 * exactly which four operations are relied on.
 */
type Ed25519Subtle = {
  importKey(
    format: 'raw',
    keyData: Uint8Array,
    algorithm: { name: 'Ed25519' },
    extractable: boolean,
    usages: readonly string[]
  ): Promise<CryptoKey>
  verify(
    algorithm: { name: 'Ed25519' },
    key: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array
  ): Promise<boolean>
}

const subtle = crypto.subtle as unknown as Ed25519Subtle

/** Discord's headers, exactly as sent. */
export const SIGNATURE_HEADER = 'x-signature-ed25519'
export const TIMESTAMP_HEADER = 'x-signature-timestamp'

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    out[i] = byte
  }
  return out
}

/**
 * Import the application's public key for verification.
 *
 * Called per request rather than cached at module scope: Workers forbid async
 * I/O in global scope, and `importKey` is async. The cost is negligible next to
 * the network round trips the handler makes anyway, and the alternative — a
 * lazily-populated module-level cache — would be shared across every isolate
 * for no measurable gain.
 */
async function importPublicKey(publicKeyHex: string): Promise<CryptoKey | null> {
  const raw = hexToBytes(publicKeyHex)
  if (!raw) return null
  try {
    return await subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify'])
  } catch {
    return null
  }
}

/**
 * True when `rawBody` really came from Discord for this application.
 *
 * Returns false — never throws — for every failure mode (absent headers,
 * malformed hex, bad key, bad signature), because the caller's response is the
 * same 401 in all of them and distinguishing them in the reply would tell a
 * prober which part they got wrong.
 */
export async function isValidDiscordRequest(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string
): Promise<boolean> {
  if (!signatureHex || !timestamp) return false

  const signature = hexToBytes(signatureHex)
  if (!signature) return false

  const key = await importPublicKey(publicKeyHex)
  if (!key) return false

  try {
    return await subtle.verify(
      { name: 'Ed25519' },
      key,
      signature,
      ENCODER.encode(timestamp + rawBody)
    )
  } catch {
    return false
  }
}
