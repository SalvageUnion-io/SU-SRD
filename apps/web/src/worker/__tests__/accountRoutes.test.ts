import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { FEEDBACK_REFUSAL } from 'game-domain/feedback'
import { BUILD_FLOOR } from '../../../convex/buildFloor'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import type { Profile } from '../../rooms/account/shelf'
import { ACCOUNT_PATHS } from '../../rooms/routes'
import type { AccountExport, Me } from '../accountRoutes'
import { isAccountPath, serveAccount } from '../accountRoutes'
import type { Identity } from '../auth/index'
import { authStore, d1Sql, saveAccount } from '../auth/store'
import { testDb } from '../shared/__tests__/d1'
import { bumpUsage } from '../shared/signals'

/**
 * The account's Worker routes, over the shared database in memory and an
 * account room stand-in: who is asking is handed in, as `identityOf` would.
 */

const ORIGIN = 'https://salvageunion.io'
const PLAYER: Identity = { accountId: 'u-1', discordId: 'd-1', admin: false }
const ADMIN: Identity = { ...PLAYER, admin: true }

const namespaces = exports as Record<string, unknown>

// happy-dom's Request drops `origin`; the Worker's is the runtime's own.
const happyDom: Partial<typeof NATIVE_FETCH_GLOBALS> = {}
beforeAll(() => {
  for (const key of Object.keys(NATIVE_FETCH_GLOBALS) as (keyof typeof NATIVE_FETCH_GLOBALS)[])
    Object.assign(happyDom, { [key]: globalThis[key] })
  Object.assign(globalThis, NATIVE_FETCH_GLOBALS)
})
afterAll(() => {
  Object.assign(globalThis, happyDom)
})
let profile: Profile = { displayName: null, avatarUrl: null }
let db: ReturnType<typeof testDb>

beforeEach(async () => {
  db = testDb()
  profile = { displayName: null, avatarUrl: null }
  await saveAccount(
    await authStore(d1Sql(db as never)),
    {
      accountId: 'u-1',
      discordId: 'd-1',
      testEmail: null,
      name: 'rosa',
      avatarUrl: 'https://cdn/discord.png',
      email: 'rosa@example.com',
    },
    1
  )
  namespaces.AccountRoom = {
    getByName: (name: string) => ({
      profile: async (actor: string) => (actor === name ? profile : null),
      setProfile: async (_actor: string, patch: Partial<Profile>) => {
        profile = { ...profile, ...patch }
      },
      exportFor: async () => ({
        pilots: [{ id: 'p1' }],
        mechs: [],
        npcs: [],
        mechPatterns: [],
        encounters: [],
      }),
    }),
  }
})

afterEach(() => {
  delete namespaces.AccountRoom
})

function call(path: string, who: Identity | null, body?: unknown, origin = ORIGIN) {
  const request = new Request(`${ORIGIN}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return serveAccount(request, { SHARED: db as never }, async () => who)
}

describe('the account’s routes', () => {
  test('are named under the rooms’ path', () => {
    expect(isAccountPath(ACCOUNT_PATHS.me)).toBe(true)
    expect(isAccountPath(`${ACCOUNT_PATHS.me}/x`)).toBe(false)
  })

  test('me: the Discord name and avatar until the player sets their own; null signed out', async () => {
    expect(await (await call(ACCOUNT_PATHS.me, null)).json()).toBeNull()
    const me = (await (await call(ACCOUNT_PATHS.me, PLAYER)).json()) as Me
    expect(me).toEqual({
      _id: 'u-1',
      discordId: 'd-1',
      displayName: 'rosa',
      avatarUrl: 'https://cdn/discord.png',
      email: 'rosa@example.com',
      admin: false,
    })
    expect((await call(ACCOUNT_PATHS.profile, PLAYER, { displayName: 'Bonesaw' })).status).toBe(200)
    const after = (await (await call(ACCOUNT_PATHS.me, PLAYER)).json()) as Me
    expect(after.displayName).toBe('Bonesaw')
  })

  test('a write from another origin, or signed out, is refused', async () => {
    const elsewhere = await call(
      ACCOUNT_PATHS.profile,
      PLAYER,
      { displayName: 'x' },
      'https://evil'
    )
    expect(elsewhere.status).toBe(403)
    expect((await call(ACCOUNT_PATHS.profile, null, { displayName: 'x' })).status).toBe(401)
    expect((await call(ACCOUNT_PATHS.export, null)).status).toBe(401)
  })

  test('export: the Shelf’s bodies, with the Games from the shared database', async () => {
    await db
      .prepare(
        'insert into memberships (game_id, discord_id, mediator, organizer) values (?1, ?2, 1, 0)'
      )
      .bind('g-1', 'd-1')
      .run()
    const mine = (await (await call(ACCOUNT_PATHS.export, PLAYER)).json()) as AccountExport
    expect(mine.pilots).toEqual([{ id: 'p1' }])
    expect(mine.games).toEqual([{ gameId: 'g-1', mediator: true, organizer: false }])
    expect(mine.homebrewReports).toEqual([])
  })

  test('feedback waits under the Discord id; a short note is refused in its words', async () => {
    const short = await call(ACCOUNT_PATHS.feedback, PLAYER, { kind: 'report', text: 'no' })
    expect(short.status).toBe(400)
    expect(await short.json()).toEqual({ refusal: FEEDBACK_REFUSAL.short })
    const sent = await call(ACCOUNT_PATHS.feedback, PLAYER, {
      kind: 'suggestion',
      text: 'A dark mode for the Cockpit, please',
      page: '/play/',
    })
    expect(sent.status).toBe(200)
    const row = await db
      .prepare('select sender, source, page from feedback')
      .first<{ sender: string; source: string; page: string }>()
    expect(row).toEqual({ sender: 'discord:d-1', source: 'app', page: '/play/' })
  })

  test('metrics are an admin’s, and a refresh takes a snapshot', async () => {
    await bumpUsage(db, 'downtime:game')
    expect(await (await call(ACCOUNT_PATHS.metrics, PLAYER)).json()).toBeNull()
    expect((await call(ACCOUNT_PATHS.refreshMetrics, PLAYER, {})).status).toBe(403)
    expect((await call(ACCOUNT_PATHS.refreshMetrics, ADMIN, {})).status).toBe(200)
    const read = (await (await call(ACCOUNT_PATHS.metrics, ADMIN)).json()) as {
      snapshot: { counts: { accounts: number } } | null
      weeks: { counts: Record<string, number> }[]
    }
    expect(read.snapshot?.counts.accounts).toBe(0)
    expect(read.weeks[0]?.counts['downtime:game']).toBe(1)
  })

  test('the build floor is anyone’s', async () => {
    expect(await (await call(ACCOUNT_PATHS.floor, null)).json()).toBe(BUILD_FLOOR)
  })
})
