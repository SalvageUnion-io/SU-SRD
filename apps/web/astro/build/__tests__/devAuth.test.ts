/**
 * The dev server's sign-in deps: the Worker's handler on a `bun:sqlite` file,
 * made once per process from the environment.
 */

import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateAuthKey } from '../../../scripts/authKeys'
import { devAuthDeps } from '../devAuth'

describe('devAuthDeps', () => {
  test('reads the key, database, Discord pair and test seam from the environment, once', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dev-auth-'))
    const signingKey = await generateAuthKey()
    const env = {
      AUTH_SIGNING_KEY: signingKey,
      AUTH_DB: join(dir, 'db/auth.sqlite'),
      VITE_CONVEX_URL: 'http://127.0.0.1:3210',
      DISCORD_CLIENT_ID: 'id',
      DISCORD_CLIENT_SECRET: 'secret',
      VITE_TEST_AUTH: 'true',
    }
    const deps = await devAuthDeps(env)
    expect(deps).toMatchObject({
      convexUrl: 'http://127.0.0.1:3210',
      discord: { clientId: 'id', clientSecret: 'secret' },
      signingKey,
      testAuth: true,
    })
    await deps.sql.run('create table t (v text)')
    await deps.sql.run('insert into t values (?)', 'x')
    expect(await deps.sql.first<{ v: string }>('select v from t')).toEqual({ v: 'x' })
    expect(await deps.sql.first('select v from t where v = ?', 'y')).toBeNull()
    expect(await devAuthDeps({})).toBe(deps)
  })
})
