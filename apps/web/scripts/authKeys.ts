#!/usr/bin/env bun
/**
 * The sign-in's keypair (`src/worker/auth/crypto.ts`): a private P-256 JWK
 * for the Worker's `AUTH_SIGNING_KEY`, and its public half as the data URI
 * Convex reads from `AUTH_JWKS` (`convex/auth.config.ts`).
 *
 *   bun scripts/authKeys.ts <key file>
 *
 * reads the private key from the file, making it first when there is none,
 * and prints the `AUTH_JWKS` value. The dev server, `bun run dev:backend` and
 * CI's throwaway backend keep theirs in a file of their own; a real
 * deployment's private half is a Worker secret and lives nowhere else.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** A fresh private JWK, `kid` included, as JSON. */
export async function generateAuthKey(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const kid = crypto.randomUUID()
  return JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d, kid })
}

/** The JWKS for a private JWK's public half, as a data URI. */
export function jwksDataUri(privateJwk: string): string {
  const { kty, crv, x, y, kid } = JSON.parse(privateJwk) as Record<string, string>
  const jwks = JSON.stringify({ keys: [{ kty, crv, x, y, kid, alg: 'ES256', use: 'sig' }] })
  return `data:text/plain;charset=utf-8;base64,${btoa(jwks)}`
}

/** The private JWK kept in `file`, made there (mode 600) the first time. */
export async function keyIn(file: string): Promise<string> {
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const key = await generateAuthKey()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, key, { mode: 0o600 })
  return key
}

if (import.meta.main) {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: bun scripts/authKeys.ts <key file>')
    process.exit(2)
  }
  // biome-ignore lint/suspicious/noConsole: the value is the output
  console.log(jwksDataUri(await keyIn(file)))
}
