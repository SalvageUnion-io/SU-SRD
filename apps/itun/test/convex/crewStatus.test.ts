import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { mechStats, pilotVitals } from '../../src/components/dashboard/slotModels'
import { crewLines } from '../../src/components/dashboard/useGameFeed'
import { mechStatus, pilotStatus } from '../../src/lib/rules/crewStatus'
import type { Mech } from '../../src/lib/schemas/mech'
import { MechSchema } from '../../src/lib/schemas/mech'
import type { Pilot } from '../../src/lib/schemas/pilot'
import { PilotSchema } from '../../src/lib/schemas/pilot'
import type { Ctx, User } from './fixtures'
import { crawlerBody, link, makeUser, mechBody, pilotBody, ref } from './fixtures'
import { testConvex } from './harness'

/**
 * The crew's maxima and status are derived on the server (`crew.vitals`;
 * docs/architecture/dashboard-redesign.md D6, §8 A3), and the Crew tab's ▲
 * and red outlines read them. These are the layer's two gates:
 *
 *   - **The server agrees with the client.** One set of records goes to both
 *     sides: written through the client's own write path, then read back by
 *     `crew.vitals`, and handed to the Dashboard's slot models
 *     (`pilotVitals`, `mechStats`) as the Dashboard would. Each maximum and
 *     each status must come out the same.
 *   - **The payload holds no Mediator-only data**, and no loadout: the
 *     records are read to derive the numbers, and only the numbers leave.
 */

/** Rook: Beefcake and Bionic Arms, one minor injury, crewing a Tech 3 crawler. */
const ROOK: Pilot = PilotSchema.parse({
  ...pilotBody({ id: 'rook', gameId: null }),
  callsign: 'Rook',
  abilities: ['beefcake', 'bionic-arms'],
  injuries: [{ severity: 'minor', note: 'cracked rib' }],
  currentHP: 4,
})

/** Wren: no abilities, no crawler, a manual crawler level. */
const WREN: Pilot = PilotSchema.parse({
  ...pilotBody({ id: 'wren', gameId: null }),
  callsign: 'Wren',
  crawlerLevel: 2,
})

/** Rook's Mule: a heat sink, armour and a destroyed capacitance bank, shut down. */
const MULE_BODY = {
  ...mechBody({ id: 'mule-1', gameId: null }),
  name: 'Kettle',
  chassisRef: 'mule',
  systems: ['heat-sink', 'composite-armour', 'capacitance-bank'],
  systemConditions: { 'capacitance-bank': 'destroyed' as const },
  shutdown: true,
}

/** Wren's Scrapper, parked and destroyed. */
const SCRAPPER: Mech = MechSchema.parse({
  ...mechBody({ id: 'scrapper-1', gameId: null }),
  name: 'Tin Can',
  chassisRef: 'scrapper',
  destroyed: true,
  currentSP: 0,
})

const CRAWLER = { techLevel: 'tech-3' }

/** Rook's switched-on effect: Squeeze it in, an activated pilotedMech contribution. */
const ROOK_EFFECTS = ['squeeze-it-in']

async function upsert(
  user: User,
  table: 'pilots' | 'mechs',
  body: { id: string },
  gameId: Id<'games'>
) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table,
    appId: body.id,
    gameId,
    body: { ...body, gameId },
    expectedUpdatedAt: null,
  })
}

/** Rook's Mule, its Heat at the derived capacity so it reads as overheating. */
function muleAtCapacity(): Mech {
  const cold = MechSchema.parse(MULE_BODY)
  const { maxHeat } = mechStats(cold, ROOK.abilities, ROOK_EFFECTS)
  return MechSchema.parse({ ...MULE_BODY, currentHeat: maxHeat })
}

async function seedCrew(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const ash = await makeUser(t, 'Ash')
  const bex = await makeUser(t, 'Bex')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.create, { gameId })
  await ash.as.mutation(api.invites.redeem, { code })
  await bex.as.mutation(api.invites.redeem, { code })
  await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })

  await gm.as.mutation(api.entities.createCrawler, {
    gameId,
    appId: 'crawler-1',
    body: { ...crawlerBody({ id: 'crawler-1', gameId, name: 'Tenacity' }), ...CRAWLER },
  })
  await upsert(ash, 'pilots', ROOK, gameId)
  await upsert(ash, 'mechs', muleAtCapacity(), gameId)
  await upsert(bex, 'pilots', WREN, gameId)
  await upsert(bex, 'mechs', SCRAPPER, gameId)
  await link(ash, ref.pilot('rook'), ref.crawler('crawler-1'), 'pilot-to-crawler')
  await link(ash, ref.mech('mule-1'), ref.pilot('rook'), 'mech-to-pilot')
  await link(bex, ref.mech('scrapper-1'), ref.pilot('wren'), 'mech-to-pilot')
  // Entering a Game assigns a pilot to its crawler (ADR-037). Wren stays off
  // it, so her Stat Training comes from her own `crawlerLevel`.
  await t.run(async (ctx) => {
    const links = await ctx.db
      .query('softLinks')
      .withIndex('by_from', (q) => q.eq('from.id', 'wren'))
      .collect()
    for (const l of links) if (l.type === 'pilot-to-crawler') await ctx.db.delete(l._id)
  })

  // Rook boards the Mule with an effect on; Wren ejects (ADR-007: their act).
  await ash.as.mutation(api.seats.board, { gameId, pilotId: 'rook', mechId: 'mule-1' })
  for (const effect of ROOK_EFFECTS) {
    await ash.as.mutation(api.seats.toggleEffect, { gameId, pilotId: 'rook', ref: effect })
  }
  await bex.as.mutation(api.seats.eject, { gameId, pilotId: 'wren' })
  return { gm, ash, bex, gameId }
}

function byAppId<T extends { appId: string | null }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.appId === id)
  if (row === undefined) throw new Error(`no row ${id}`)
  return row
}

describe('crew.vitals derives what the client derives', () => {
  test('pilot maxima, for a crawler crew and for a manual crawler level', async () => {
    const t = testConvex()
    const { bex, gameId } = await seedCrew(t)
    const crew = await bex.as.query(api.crew.vitals, { gameId })

    const rook = byAppId(crew.pilots, 'rook')
    const [hp, ap] = pilotVitals(ROOK, CRAWLER).gauges
    expect(rook.maxHP).toBe(hp?.max ?? -1)
    expect(rook.maxAP).toBe(ap?.max ?? -1)
    // Not two zeroes agreeing: 10 base + 4 Stat Training (Tech 3) + 2 Beefcake
    // + 2 Bionic Arms − 1 for the injury.
    expect(rook.maxHP).toBe(17)

    const wren = byAppId(crew.pilots, 'wren')
    const [wHp, wAp] = pilotVitals(WREN, null).gauges
    expect(wren.maxHP).toBe(wHp?.max ?? -1)
    expect(wren.maxAP).toBe(wAp?.max ?? -1)
  })

  test('mech maxima, boarded with an effect on and parked', async () => {
    const t = testConvex()
    const { ash, gameId } = await seedCrew(t)
    const crew = await ash.as.query(api.crew.vitals, { gameId })

    const mule = byAppId(crew.mechs, 'mule-1')
    const client = mechStats(muleAtCapacity(), ROOK.abilities, ROOK_EFFECTS)
    expect([mule.maxSP, mule.maxEP, mule.maxHeat]).toEqual([
      client.maxSP,
      client.maxEP,
      client.maxHeat,
    ])
    // Beefcake reached the Mule through the pilot aboard it.
    expect(client.maxSP).toBeGreaterThan(mechStats(muleAtCapacity(), [], []).maxSP)

    const scrapper = byAppId(crew.mechs, 'scrapper-1')
    const parked = mechStats(SCRAPPER, WREN.abilities, [])
    expect([scrapper.maxSP, scrapper.maxEP, scrapper.maxHeat]).toEqual([
      parked.maxSP,
      parked.maxEP,
      parked.maxHeat,
    ])
  })

  test('status: injured, ejected; shut down, overheating, destroyed', async () => {
    const t = testConvex()
    const { ash, gameId } = await seedCrew(t)
    const crew = await ash.as.query(api.crew.vitals, { gameId })

    const rook = byAppId(crew.pilots, 'rook')
    expect(rook.status).toEqual(pilotStatus(ROOK, CRAWLER, false))
    expect(rook.status).toEqual({ dead: false, injured: true, ejected: false })
    expect(rook.attention).toBe(true)
    expect(rook.boarded).toBe(true)
    expect(rook.mechId).toBe('mule-1')

    const wren = byAppId(crew.pilots, 'wren')
    expect(wren.status).toEqual({ dead: false, injured: false, ejected: true })
    expect(wren.attention).toBe(true)
    // On foot: the mech named is the one assigned to them.
    expect(wren.boarded).toBe(false)
    expect(wren.mechId).toBe('scrapper-1')

    const mule = byAppId(crew.mechs, 'mule-1')
    const client = muleAtCapacity()
    expect(mule.status).toEqual(
      mechStatus(client, mechStats(client, ROOK.abilities, ROOK_EFFECTS).maxHeat)
    )
    expect(mule.status).toEqual({
      destroyed: false,
      shutdown: true,
      overheating: true,
      destroyedSystems: ['Capacitance Bank'],
      destroyedModules: [],
    })
    expect(mule.attention).toBe(true)

    const scrapper = byAppId(crew.mechs, 'scrapper-1')
    expect(scrapper.status?.destroyed).toBe(true)
    expect(scrapper.attention).toBe(true)
  })

  test('boarding again clears the ejection', async () => {
    const t = testConvex()
    const { bex, gameId } = await seedCrew(t)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('mechs')
        .withIndex('by_app_id', (q) => q.eq('appId', 'scrapper-1'))
        .unique()
      if (row) await ctx.db.patch(row._id, { body: { ...row.body, destroyed: false } })
    })
    await bex.as.mutation(api.seats.board, { gameId, pilotId: 'wren', mechId: 'scrapper-1' })

    const wren = byAppId((await bex.as.query(api.crew.vitals, { gameId })).pilots, 'wren')
    expect(wren.status.ejected).toBe(false)
    expect(wren.attention).toBe(false)
  })
})

describe('crew.vitals keys a template pre-gen by its link id', () => {
  test('a Starter Set pilot and mech, with no app id, reach the Crew tab as a row', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const gameId = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const before = await u.as.query(api.crew.vitals, { gameId })
    const rows = [...before.pilots, ...before.mechs]
    // Starter Set rows carry only a body id, and claiming one adds none…
    expect(before.pilots.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.appId === null)).toBe(true)
    // …yet every row carries the id the seats and `mechId` name it by.
    expect(rows.every((r) => r.linkId !== null)).toBe(true)

    // A pre-gen with an assigned mech: its `mechId` is that mech's `linkId`.
    const pilot = before.pilots.find((p) => p.mechId !== null)
    const pilotId = pilot?.linkId ?? null
    const mechId = pilot?.mechId ?? null
    if (pilotId === null || mechId === null) throw new Error('no assigned pre-gen')
    const mech = before.mechs.find((m) => m.linkId === mechId)
    expect(mech).toBeDefined()

    await u.as.mutation(api.ownership.claim, { table: 'pilots', entityId: pilot?._id ?? '' })
    await u.as.mutation(api.ownership.claim, { table: 'mechs', entityId: mech?._id ?? '' })
    await u.as.mutation(api.seats.board, { gameId, pilotId, mechId })

    const crew = await u.as.query(api.crew.vitals, { gameId })
    expect(crew.pilots.every((p) => p.appId === null)).toBe(true)
    const seats = await u.as.query(api.seats.forGame, { gameId })
    const lines = crewLines(crew, seats, pilotId)
    // Every pre-gen has a row, and the boarded one carries its mech's numbers.
    expect(lines).toHaveLength(crew.pilots.length)
    const own = lines[0]
    expect(own?.pilotId).toBe(pilotId)
    expect(own?.self).toBe(true)
    expect(own?.href).toBe(`/sheet/pilot/${pilotId}`)
    expect(own?.where).toBe(`In ${mech?.name}`)
    expect(own?.vitals).toMatch(/^HP \d+\/\d+ · AP \d+\/\d+$/)
    expect(own?.mech).toMatch(/ · SP \d+\/\d+ · Heat \d+\/\d+$/)
  })
})

/** Every key anywhere in a value, for asserting what a payload cannot carry. */
function keysIn(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysIn(v, into)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k)
      keysIn(v, into)
    }
  }
  return into
}

describe('crew.vitals carries only what a crewmate may see', () => {
  test('no Mediator-only data and no loadouts, to a player', async () => {
    const t = testConvex()
    const { gm, ash, gameId } = await seedCrew(t)
    // The Mediator's prepared opposition: the one table a player cannot read.
    await gm.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'Warden Vasquez' } })

    const crew = await ash.as.query(api.crew.vitals, { gameId })
    const text = JSON.stringify(crew)
    expect(text).not.toContain('Warden Vasquez')
    // The crawler is read for its Tech Level alone.
    expect(text).not.toContain('crawler-1')

    const keys = keysIn(crew)
    for (const loadout of [
      'body',
      'abilities',
      'equipment',
      'systems',
      'modules',
      'injuries',
      'cargoLots',
      'activeEffects',
      'resolving',
    ]) {
      expect(keys.has(loadout)).toBe(false)
    }
  })
})
