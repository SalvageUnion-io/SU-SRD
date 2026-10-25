/**
 * The Worker's sign-in (`src/worker/auth/`) on the dev server: the same
 * handler, its accounts and sessions in a `bun:sqlite` file instead of D1.
 *
 * Its key and database sit in `.wrangler/` (gitignored) unless
 * `AUTH_SIGNING_KEY` and `AUTH_DB` say otherwise (`bun run dev:backend` keeps
 * both in `.dev-backend/`). Convex must hold the key's public half as
 * `AUTH_JWKS`; the first start prints the command that sets it.
 */

import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { jwksDataUri, keyIn } from '../scripts/authKeys'
import type { AuthDeps } from '../src/worker/auth/index'
import type { AuthSql } from '../src/worker/auth/store'

/** `bun:sqlite` as the store's slice of D1. */
export function bunAuthSql(db: Database): AuthSql {
  db.run('pragma foreign_keys = on')
  return {
    async run(query, ...bindings) {
      db.query(query).run(...bindings)
    },
    async first<Row>(query: string, ...bindings: (string | number | null)[]) {
      return (db.query(query).get(...bindings) as Row | null) ?? null
    },
  }
}

const WRANGLER_DIR = join(import.meta.dir, '../.wrangler')

let deps: Promise<AuthDeps> | null = null

/** The dev server's sign-in, made once. */
export function devAuthDeps(env = process.env): Promise<AuthDeps> {
  deps ??= (async () => {
    const keyFile = join(WRANGLER_DIR, 'dev-auth-key.json')
    const signingKey = env.AUTH_SIGNING_KEY ?? (await keyIn(keyFile))
    if (!env.AUTH_SIGNING_KEY)
      // biome-ignore lint/suspicious/noConsole: build-time CLI — the hint is the interface
      console.log(
        `[dev] sign-in signs with ${keyFile}; the Convex deployment needs its public half once:\n` +
          `  bunx convex env set AUTH_JWKS ${jwksDataUri(signingKey)}`
      )
    const file = env.AUTH_DB ?? join(WRANGLER_DIR, 'dev-auth.sqlite')
    mkdirSync(dirname(file), { recursive: true })
    return {
      sql: bunAuthSql(new Database(file, { create: true })),
      convexUrl: env.VITE_CONVEX_URL ?? '',
      discord:
        env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
          ? { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET }
          : undefined,
      signingKey,
      testAuth: env.TEST_AUTH === 'true' || env.VITE_TEST_AUTH === 'true',
    }
  })()
  return deps
}
