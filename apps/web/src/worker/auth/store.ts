/**
 * Accounts and sessions, in the shared D1 database (`SHARED`, `wrangler.jsonc`).
 *
 * An account's id is made on its first sign-in (one that signed in while
 * Convex was the server of record keeps its Convex `users` id). It is found
 * again by how it signs in: `discord_id`, or `test_email` where `TEST_AUTH`
 * allows the test seam. `name` is Discord's
 * and every sign-in refreshes it; `display_name` is the player's own, which
 * sign-in never writes. A session is a random token in an HttpOnly cookie; the
 * table keeps only its SHA-256, so a read of the database signs nobody in.
 *
 * The tables are made on first use in each isolate, `if not exists`, so a
 * fresh database (a Preview's, `wrangler dev`'s, the dev server's) needs no
 * migration step.
 */

import type { SqlValue } from '../../rooms/sql'
import type { SharedDb } from '../shared/db'
import { sha256Hex } from './crypto'

/** The slice of D1 the store uses, so tests and the dev server run it on `bun:sqlite`. */
export type AuthSql = {
  run(query: string, ...bindings: SqlValue[]): Promise<void>
  first<Row>(query: string, ...bindings: SqlValue[]): Promise<Row | null>
}

export function d1Sql(db: SharedDb): AuthSql {
  return {
    async run(query, ...bindings) {
      await db
        .prepare(query)
        .bind(...bindings)
        .run()
    },
    first: (query, ...bindings) =>
      db
        .prepare(query)
        .bind(...bindings)
        .first(),
  }
}

const SCHEMA = [
  `create table if not exists accounts (
    account_id text primary key,
    discord_id text unique,
    test_email text unique,
    name text,
    display_name text,
    avatar_url text,
    email text,
    secret text,
    created_at integer not null,
    updated_at integer not null
  )`,
  `create table if not exists sessions (
    id text primary key,
    account_id text not null references accounts(account_id) on delete cascade,
    expires_at integer not null
  )`,
  'create index if not exists sessions_by_account on sessions(account_id)',
]

const ready = new WeakMap<AuthSql, Promise<void>>()

/** The store, its tables in place. */
export async function authStore(sql: AuthSql): Promise<AuthSql> {
  let schema = ready.get(sql)
  if (schema === undefined) {
    schema = (async () => {
      for (const statement of SCHEMA) await sql.run(statement)
    })()
    ready.set(sql, schema)
  }
  await schema
  return sql
}

/** How an account signs in, and the profile that sign-in brings. */
export type SignIn = {
  discordId: string | null
  testEmail: string | null
  name: string | null
  avatarUrl: string | null
  email: string | null
}

export type Account = SignIn & { accountId: string }

type AccountRow = {
  account_id: string
  discord_id: string | null
  test_email: string | null
  name: string | null
  avatar_url: string | null
  email: string | null
}

function accountOf(row: AccountRow): Account {
  return {
    accountId: row.account_id,
    discordId: row.discord_id,
    testEmail: row.test_email,
    name: row.name,
    avatarUrl: row.avatar_url,
    email: row.email,
  }
}

/** How long a session lasts; one used in its second half is renewed for as long again. */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000

/** A test account's stored password hash, or `undefined` when there is no such account. */
export async function testSecret(sql: AuthSql, email: string): Promise<string | null | undefined> {
  const row = await sql.first<{ secret: string | null }>(
    'select secret from accounts where test_email = ?',
    email
  )
  return row === null ? undefined : row.secret
}

/** The id of the account this sign-in signs in to, or `null` for its first. */
export async function accountIdOf(sql: AuthSql, signIn: SignIn): Promise<string | null> {
  const row = await sql.first<{ account_id: string }>(
    'select account_id from accounts where discord_id = ? or test_email = ?',
    signIn.discordId,
    signIn.testEmail
  )
  return row?.account_id ?? null
}

/** Saves the account under its id, its profile refreshed from the sign-in. */
export async function saveAccount(
  sql: AuthSql,
  account: Account & { secret?: string },
  now: number
): Promise<void> {
  await sql.run(
    `insert into accounts
       (account_id, discord_id, test_email, name, avatar_url, email, secret, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (account_id) do update set
       discord_id = excluded.discord_id, test_email = excluded.test_email,
       name = excluded.name, avatar_url = excluded.avatar_url, email = excluded.email,
       secret = coalesce(accounts.secret, excluded.secret), updated_at = excluded.updated_at`,
    account.accountId,
    account.discordId,
    account.testEmail,
    account.name,
    account.avatarUrl,
    account.email,
    account.secret ?? null,
    now,
    now
  )
}

/** A new session for the account: the cookie's token. Its expired sessions go. */
export async function openSession(sql: AuthSql, accountId: string, now: number): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  await sql.run('delete from sessions where account_id = ? and expires_at <= ?', accountId, now)
  await sql.run(
    'insert into sessions (id, account_id, expires_at) values (?, ?, ?)',
    await sha256Hex(token),
    accountId,
    now + SESSION_MS
  )
  return token
}

export type Session = {
  account: Account
  /** A short, stable name for the session: the subject's second half. */
  sessionId: string
  /** Whether this read renewed it, so the cookie is set again. */
  renewed: boolean
}

/** The live session the token names, renewed in its second half; `null` if none. */
export async function readSession(
  sql: AuthSql,
  token: string,
  now: number
): Promise<Session | null> {
  const id = await sha256Hex(token)
  const row = await sql.first<AccountRow & { expires_at: number }>(
    `select accounts.*, sessions.expires_at from sessions
     join accounts on accounts.account_id = sessions.account_id
     where sessions.id = ? and sessions.expires_at > ?`,
    id,
    now
  )
  if (row === null) return null
  const renewed = row.expires_at - now < SESSION_MS / 2
  if (renewed)
    await sql.run('update sessions set expires_at = ? where id = ?', now + SESSION_MS, id)
  return { account: accountOf(row), sessionId: id.slice(0, 16), renewed }
}

export async function closeSession(sql: AuthSql, token: string): Promise<void> {
  await sql.run('delete from sessions where id = ?', await sha256Hex(token))
}

/** The account's sign-in and every session it has, gone: its Convex account was deleted. */
export async function forgetAccount(sql: AuthSql, accountId: string): Promise<void> {
  await sql.run('delete from sessions where account_id = ?', accountId)
  await sql.run('delete from accounts where account_id = ?', accountId)
}
