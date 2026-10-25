/**
 * `auth.config.ts`: the Worker's two issuers, ES256 against `AUTH_JWKS`, or
 * nobody at all while the deployment has no key. The config reads the
 * environment as it loads, so each case loads its own copy.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { LINK_ISSUER, SESSION_ISSUER, TOKEN_AUDIENCE } from 'game-domain/authWire'

const load = async (copy: string) =>
  (await import(`../../../convex/auth.config.ts?${copy}`)).default as {
    providers: Record<string, string>[]
  }

afterEach(() => {
  delete process.env.AUTH_JWKS
})

describe('auth.config', () => {
  test("accepts the Worker's session and link tokens against AUTH_JWKS", async () => {
    process.env.AUTH_JWKS = 'data:text/plain;base64,e30='
    const { providers } = await load('with-key')
    expect(providers).toEqual(
      [SESSION_ISSUER, LINK_ISSUER].map((issuer) => ({
        type: 'customJwt',
        applicationID: TOKEN_AUDIENCE,
        issuer,
        jwks: 'data:text/plain;base64,e30=',
        algorithm: 'ES256',
      }))
    )
  })

  test('accepts no token without AUTH_JWKS', async () => {
    expect((await load('without-key')).providers).toEqual([])
  })
})
