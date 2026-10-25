/**
 * The sign-in's cryptography, on WebCrypto alone: hashes, and the ES256 tokens
 * Convex accepts as a custom JWT provider (`convex/auth.config.ts`).
 *
 * The key is `AUTH_SIGNING_KEY`, a private P-256 JWK with its `kid`
 * (`scripts/authKeys.ts` makes the pair). Convex holds the public half as
 * `AUTH_JWKS`, a data URI, so it never fetches anything from the site.
 */

const encoder = new TextEncoder()

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const base64urlJson = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)))

export type SigningKey = { key: CryptoKey; kid: string }

const imported = new Map<string, Promise<SigningKey>>()

/** The private JWK, imported once per isolate. Throws on a key that is not ES256 with a `kid`. */
export function signingKey(jwkJson: string): Promise<SigningKey> {
  let key = imported.get(jwkJson)
  if (key === undefined) {
    key = (async () => {
      const jwk = JSON.parse(jwkJson) as JsonWebKey & { kid?: string }
      if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || !jwk.kid)
        throw new Error('AUTH_SIGNING_KEY is not a private P-256 JWK with a kid')
      const { kid, ...material } = jwk
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        material,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      )
      return { key: cryptoKey, kid }
    })()
    imported.set(jwkJson, key)
  }
  return key
}

/**
 * A signed JWT. WebCrypto's ECDSA signature is already JWS's `r || s`.
 * `claims` should carry `iss`, `sub` and `aud`; `iat` and `exp` are added.
 */
export async function signToken(
  { key, kid }: SigningKey,
  claims: Record<string, unknown>,
  ttlSeconds: number,
  now: number
): Promise<string> {
  const iat = Math.floor(now / 1000)
  const body = `${base64urlJson({ alg: 'ES256', typ: 'JWT', kid })}.${base64urlJson({ ...claims, iat, exp: iat + ttlSeconds })}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(body)
  )
  return `${body}.${base64url(new Uint8Array(signature))}`
}
