/**
 * The sign-in keypair: a private JWK kept in a file, and the public half as
 * the data URI Convex reads from `AUTH_JWKS`.
 */

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jwksDataUri, keyIn } from '../authKeys'

const SCRIPT = join(import.meta.dir, '../authKeys.ts')

describe('authKeys', () => {
  test('makes the key once, owner-only, and keeps answering it', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'auth-keys-')), 'nested/key.json')
    const key = await keyIn(file)
    expect(JSON.parse(key)).toMatchObject({ kty: 'EC', crv: 'P-256', d: expect.any(String) })
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(await keyIn(file)).toBe(key)
  })

  test('the JWKS carries the public half only', async () => {
    const key = JSON.parse(await keyIn(join(mkdtempSync(join(tmpdir(), 'auth-keys-')), 'k.json')))
    const uri = jwksDataUri(JSON.stringify(key))
    const prefix = 'data:text/plain;charset=utf-8;base64,'
    expect(uri.startsWith(prefix)).toBe(true)
    const { keys } = JSON.parse(atob(uri.slice(prefix.length)))
    expect(keys).toEqual([
      { kty: 'EC', crv: 'P-256', x: key.x, y: key.y, kid: key.kid, alg: 'ES256', use: 'sig' },
    ])
  })

  test('as a command, prints the JWKS, or its usage without a file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'auth-keys-')), 'k.json')
    const run = Bun.spawnSync(['bun', SCRIPT, file])
    expect(run.exitCode).toBe(0)
    expect(run.stdout.toString()).toStartWith('data:text/plain')
    const usage = Bun.spawnSync(['bun', SCRIPT])
    expect(usage.exitCode).toBe(2)
    expect(usage.stderr.toString()).toContain('usage:')
  })
})
