import { describe, expect, test } from 'bun:test'
import type { Tables } from '../convex-copy'
import { buildBundles, summarize } from '../convex-copy'

const row = (id: string, fields: Record<string, unknown>) => ({
  _id: id,
  _creationTime: 1,
  ...fields,
})

const tables: Tables = {
  users: [row('u1', { displayName: 'Rook' }), row('u2', { name: 'Vance' }), row('u3', {})],
  authAccounts: [
    row('a1', { userId: 'u1', provider: 'discord', providerAccountId: 'd1' }),
    row('a2', { userId: 'u2', provider: 'discord', providerAccountId: 'd2' }),
  ],
  games: [row('g1', { name: 'Wasteland', primaryCrawlerId: 'c1' })],
  memberships: [
    row('m1', { gameId: 'g1', userId: 'u1', mediator: true, organizer: true, joinedAt: 5 }),
    row('m2', { gameId: 'g1', userId: 'u2', mediator: false, organizer: false, joinedAt: 6 }),
  ],
  invites: [
    row('i1', { gameId: 'g1', code: 'old', revokedAt: 2 }),
    row('i2', { gameId: 'g1', code: 'live' }),
  ],
  pilots: [
    row('p1', {
      gameId: null,
      ownerId: 'u1',
      appId: 'pilot-a',
      body: { name: 'A' },
      updatedAt: 10,
    }),
    row('p2', {
      gameId: 'g1',
      ownerId: 'u2',
      appId: 'pilot-b',
      body: { name: 'B' },
      updatedAt: 11,
      publicRead: true,
    }),
    row('p3', { gameId: null, ownerId: null, appId: 'pilot-c', body: {}, updatedAt: 12 }),
  ],
  crawlers: [
    row('c1', { gameId: 'g1', ownerId: null, appId: 'crawler-a', body: {}, updatedAt: 13 }),
  ],
  changeLog: [
    row('l1', {
      entityType: 'pilot',
      entityId: 'pilot-b',
      ts: 20,
      kind: 'manual',
      field: 'currentHP',
      before: 5,
      after: 3,
      source: 'play',
      actorId: 'u2',
      state: 'applied',
    }),
    row('l2', {
      entityType: 'pilot',
      entityId: 'pilot-b',
      ts: 21,
      kind: 'transaction',
      field: 'currentHP',
      before: 3,
      after: 1,
      source: 'propose',
      actorId: 'u1',
      state: 'proposed',
      reason: 'ouch',
    }),
  ],
  mechPatterns: [
    row('mp1', {
      ownerId: 'u1',
      gameId: 'g1',
      appId: 'pat-a',
      body: {},
      publicRead: true,
      homebrew: true,
    }),
  ],
  homebrewReports: [row('hr1', { patternId: 'mp1', reporterId: 'u2', reason: 'spam', at: 30 })],
  encounterNpcs: [
    row('n1', { gameId: 'g1', ownerId: null, appId: 'npc-a', body: {} }),
    row('n2', { gameId: null, ownerId: 'u1', appId: 'npc-b', body: {} }),
  ],
  seats: [
    row('s1', { gameId: 'g1', pilotId: 'pilot-b', mount: 'foot', lastSeenAt: 99, updatedAt: 1 }),
  ],
}

describe('buildBundles', () => {
  const r = buildBundles(tables)

  test('keys accounts by Discord id and skips users without one', () => {
    expect(r.accounts.map((a) => a.discordId)).toEqual(['d1', 'd2'])
    expect(r.accounts[0]?.name).toBe('Rook')
    expect(r.skipped).toContainEqual({ table: 'users', id: 'u3', reason: 'no Discord account' })
  })

  test('puts shelf units on the account and Game units in the Game', () => {
    expect(r.accounts[0]?.units.map((u) => u.appId)).toEqual(['pilot-a'])
    const game = r.games[0]
    expect(game?.units.map((u) => u.appId).sort()).toEqual(['crawler-a', 'pilot-b'])
    expect(game?.units.find((u) => u.appId === 'pilot-b')?.owner).toBe('d2')
    expect(game?.primaryCrawler).toBe('crawler-a')
    expect(r.skipped).toContainEqual({
      table: 'pilots',
      id: 'p3',
      reason: 'neither in a Game nor on a known shelf',
    })
  })

  test('carries history and pending proposals as ops on the unit', () => {
    const ops = r.games[0]?.units.find((u) => u.appId === 'pilot-b')?.ops ?? []
    expect(ops.map((o) => [o.id, o.state, o.author])).toEqual([
      ['l1', 'applied', 'd2'],
      ['l2', 'proposed', 'd1'],
    ])
    expect(ops[1]?.patch).toEqual({ currentHP: 1 })
    expect(ops[1]?.before).toBeNull()
    expect(ops[1]?.reason).toBe('ouch')
  })

  test('copies members, the live invite and the hidden Opposition', () => {
    const game = r.games[0]
    expect(game?.members.map((m) => [m.discordId, m.mediator])).toEqual([
      ['d1', true],
      ['d2', false],
    ])
    expect(game?.inviteCode).toBe('live')
    expect(game?.opposition.map((n) => n.appId)).toEqual(['npc-a'])
    expect(r.accounts[0]?.npcTray.map((n) => n.appId)).toEqual(['npc-b'])
    expect(game?.crewPatterns).toEqual(['pat-a'])
  })

  test('drops presence from seats and maps homebrew to app ids', () => {
    expect(r.games[0]?.seats[0]).not.toHaveProperty('lastSeenAt')
    expect(r.site.homebrewReports).toEqual([
      { patternAppId: 'pat-a', reporter: 'd2', reason: 'spam', at: 30 },
    ])
  })

  test('summarize counts every source unit', () => {
    expect(summarize(tables, r)).toEqual({
      accounts: 2,
      games: 1,
      units: 3,
      sourceUnits: 4,
      skipped: 2,
    })
  })
})
