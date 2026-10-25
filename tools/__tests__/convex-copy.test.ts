import { describe, expect, spyOn, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Tables } from '../convex-copy'
import { buildBundles, main, summarize } from '../convex-copy'

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

describe('the tables around the units', () => {
  const t: Tables = {
    users: [row('u1', { displayName: 'Rook' })],
    authAccounts: [row('a1', { userId: 'u1', provider: 'discord', providerAccountId: 'd1' })],
    games: [row('g1', { name: 'Wasteland' })],
    pilots: [
      row('p1', { gameId: null, ownerId: 'u1', appId: 'pilot-a', body: {}, updatedAt: 1 }),
      row('p2', { gameId: 'g1', ownerId: 'u1', appId: 'pilot-b', body: {}, updatedAt: 1 }),
    ],
    mechPatterns: [row('mp1', { ownerId: 'u9', appId: 'pat-x', body: {} })],
    encounters: [
      row('e1', { ownerId: 'u1', appId: 'enc-a', body: {} }),
      row('e2', { ownerId: 'u9', appId: 'enc-b', body: {} }),
    ],
    encounterNpcs: [row('n1', { gameId: null, ownerId: null, appId: 'npc-x', body: {} })],
    memberships: [row('m1', { gameId: 'g9', userId: 'u1' })],
    softLinks: [
      row('l1', {
        type: 'pilot-mech',
        gameId: 'g1',
        from: { type: 'pilot', id: 'pilot-b' },
        to: { type: 'mech', id: 'm' },
        slot: 1,
      }),
      row('l2', {
        type: 'pilot-mech',
        from: { type: 'pilot', id: 'pilot-a' },
        to: { type: 'mech', id: 'm' },
      }),
      row('l3', {
        type: 'pilot-mech',
        from: { type: 'pilot', id: 'x' },
        to: { type: 'mech', id: 'y' },
      }),
    ],
    seats: [row('s1', { ownerId: 'u1', pilotId: 'pilot-a', lastSeenAt: 9 })],
    downtime: [row('d1', { gameId: 'g1', step: 2 })],
    runningEncounters: [row('r1', { gameId: 'g1', body: { round: 3 } })],
    scenes: [row('sc1', { gameId: 'g1', conditions: ['freezing'], hours: 2, updatedAt: 3 })],
    salvageAreas: [
      row('sa1', { gameId: 'g1', name: 'Camp', techLevel: 2, supply: 3, updatedAt: 4 }),
      row('sa2', { ownerId: 'u1', name: 'Wreck', techLevel: 1, supply: 1, updatedAt: 5 }),
    ],
    ledgers: [row('lg1', { gameId: 'g1', body: { factions: [], jobs: [] } })],
    boundaries: [
      row('bd1', { gameId: 'g1', kind: 'offCamera', text: 'Spiders', addedBy: 'u1', addedAt: 6 }),
      row('bd2', { gameId: 'g1', kind: 'offCamera', text: 'Rats', addedBy: 'u9', addedAt: 6 }),
    ],
    safety: [
      row('sf1', { gameId: 'g1', stop: { shownBy: 'u1', shownAt: 7 }, postToChannel: true }),
    ],
    channelBindings: [
      row('b1', { gameId: 'g1', channelId: 'c1', boundBy: 'u1' }),
      row('b2', { channelId: 'c2', boundBy: 'u1' }),
    ],
    homebrewReports: [row('hr1', { patternId: 'gone', reporterId: 'u1', reason: 'x', at: 1 })],
    homebrewModeration: [
      row('hm0', { patternId: 'mp1', hidden: false }),
      row('hm1', { patternId: 'mp1', hidden: true, hiddenAt: 4, reportCount: 2 }),
    ],
    usageCounts: [row('uc1', { key: 'build', weekStart: 7, count: 3 })],
    botGuilds: [row('bg1', { guildId: 'G', firstSeenAt: 1, lastSeenAt: 2 })],
    metricsSnapshots: [row('ms1', { at: 5 })],
    feedback: [row('f1', { text: 'hi' })],
    photos: [
      row('ph1', { storageId: 'st1', ownerId: 'u1' }),
      row('ph2', { storageId: 'st2', ownerId: 'u9' }),
    ],
  }
  const r = buildBundles(t)
  const account = r.accounts[0]
  const game = r.games[0]

  test('skips patterns, encounters, NPCs and members with nowhere to go', () => {
    expect(account?.encounters.map((e) => e.appId)).toEqual(['enc-a'])
    expect(r.skipped.map((s) => s.id)).toEqual(['mp1', 'e2', 'n1', 'm1', 'l3', 'bd2'])
  })

  test('puts links, seats and bindings in the Game or on the shelf', () => {
    expect(game?.links).toEqual([
      {
        type: 'pilot-mech',
        from: { type: 'pilot', id: 'pilot-b' },
        to: { type: 'mech', id: 'm' },
        slot: 1,
      },
    ])
    expect(account?.links.map((l) => l.from.id)).toEqual(['pilot-a'])
    expect(account?.seats).toEqual([{ ownerId: 'u1', pilotId: 'pilot-a' }])
    expect(game?.downtime).toEqual({ gameId: 'g1', step: 2 })
    expect(game?.runningEncounter).toEqual({ round: 3 })
    expect(game?.channelBindings.map((b) => [b.channelId, b.boundBy])).toEqual([['c1', 'd1']])
    expect(account?.channelBindings.map((b) => b.channelId)).toEqual(['c2'])
  })

  test('carries the Scene, salvage areas, ledger and Safety Protocols', () => {
    expect(game?.scene).toEqual({ conditions: ['freezing'], hours: 2, updatedAt: 3 })
    expect(game?.salvageArea).toMatchObject({ name: 'Camp', supply: 3 })
    expect(account?.salvageArea).toMatchObject({ name: 'Wreck', supply: 1 })
    expect(game?.ledger).toEqual({ factions: [], jobs: [] })
    expect(game?.boundaries).toEqual([
      { id: 'bd1', kind: 'offCamera', text: 'Spiders', addedBy: 'd1', addedAt: 6 },
    ])
    expect(game?.stopSign).toEqual({
      shownBy: 'd1',
      shownAt: 7,
      postToChannel: true,
      postedAt: null,
    })
  })

  test('copies the site tables', () => {
    expect(r.site.homebrewReports).toEqual([])
    expect(r.site.homebrewHidden).toEqual([{ patternAppId: 'pat-x', hiddenAt: 4, reportCount: 2 }])
    expect(r.site.usageCounts).toEqual([{ key: 'build', weekStart: 7, count: 3 }])
    expect(r.site.botGuilds).toEqual([{ guildId: 'G', firstSeenAt: 1, lastSeenAt: 2 }])
    expect(r.site.metricsSnapshots).toEqual([{ at: 5 }])
    expect(r.site.feedback).toEqual([{ text: 'hi' }])
    expect(r.site.photos).toEqual([{ storageId: 'st1', owner: 'd1' }])
  })
})

describe('copyExport', () => {
  test('reads an unzipped export and writes a file per account and Game', () => {
    const dir = mkdtempSync(join(tmpdir(), 'convex-export-'))
    for (const [name, docs] of Object.entries(tables)) {
      mkdirSync(join(dir, name))
      writeFileSync(
        join(dir, name, 'documents.jsonl'),
        `${docs.map((d) => JSON.stringify(d)).join('\n')}\n`
      )
    }
    mkdirSync(join(dir, '_tables'))
    const out = join(dir, 'out')
    const log = spyOn(console, 'log').mockImplementation(() => {})
    const error = spyOn(console, 'error').mockImplementation(() => {})
    expect(main([dir])).toBe(1)
    expect(main([dir, out])).toBe(0)
    expect(JSON.parse(String(log.mock.calls[0]?.[0])).units).toBe(3)
    log.mockRestore()
    error.mockRestore()
    expect(readdirSync(join(out, 'accounts')).sort()).toEqual(['d1.json', 'd2.json'])
    expect(JSON.parse(readFileSync(join(out, 'games', 'g1.json'), 'utf8')).inviteCode).toBe('live')
    expect(JSON.parse(readFileSync(join(out, 'skipped.json'), 'utf8'))).toHaveLength(2)
  })
})
