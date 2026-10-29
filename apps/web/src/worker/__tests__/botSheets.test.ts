import { describe, expect, it } from 'bun:test'
import { SHEET_NOT_FOUND } from 'game-domain/botDenials'
import type { SheetVitals } from 'game-domain/botWire'
import type { BotRooms } from '../botSheets'
import { mine, sheet } from '../botSheets'
import { publish, publishGame, signedIn, testDb } from '../shared/__tests__/d1'

/**
 * `/su sheet` from the rooms: the caller's Shelf, their Games' units, and a
 * published sheet anyone may read.
 */

type Unit = { id: string; kind: 'pilot' | 'mech' | 'crawler'; body: Record<string, unknown> }

const ROSA_PILOT: Unit = { id: 'p-rosa', kind: 'pilot', body: { name: 'Rosa Vance' } }
const SHELF_MECH: Unit = { id: 'm-shelf', kind: 'mech', body: { name: 'Spare Mule' } }
const TAM_PILOT: Unit = { id: 'p-tam', kind: 'pilot', body: { name: 'Tam' } }
const CRAWLER: Unit = { id: 'c-1', kind: 'crawler', body: { name: 'Rustbucket' } }
const SHELF_VITALS: SheetVitals = {
  kind: 'mech',
  maxSP: 10,
  maxEP: 6,
  maxHeat: 8,
  status: null,
  attention: false,
}

/** Rooms that answer only Rosa: her Shelf, and Reclamation where Tam plays too. */
const rooms: BotRooms = {
  account: (discordId) => ({
    unitsFor: async (actor) => (actor === discordId && actor === 'd-rosa' ? [SHELF_MECH] : []),
    unit: async (actor, id) =>
      actor === 'd-rosa' && discordId === 'd-rosa' && id === SHELF_MECH.id
        ? { ...SHELF_MECH, vitals: SHELF_VITALS }
        : null,
    // Rosa named herself; Discord calls her `rosa`.
    profile: async (actor) =>
      actor === 'd-rosa' && discordId === 'd-rosa'
        ? { displayName: 'Rosa', avatarUrl: null }
        : null,
  }),
  game: (gameId) => ({
    unitsFor: async (actor) =>
      gameId === 'g-1' && actor === 'd-rosa' ? [ROSA_PILOT, CRAWLER] : [],
    unit: async (actor, id) => {
      if (gameId !== 'g-1' || actor !== 'd-rosa') return null
      const unit = [ROSA_PILOT, TAM_PILOT, CRAWLER].find((u) => u.id === id)
      if (unit === undefined) return null
      return { ...unit, ownerName: unit === TAM_PILOT ? 'Tam' : unit === CRAWLER ? null : 'Rosa' }
    },
  }),
}

async function table() {
  const db = testDb()
  signedIn(
    db,
    { accountId: 'acct-rosa', discordId: 'd-rosa', name: 'rosa' },
    { accountId: 'acct-ines', discordId: 'd-ines', name: 'ines' }
  )
  await publishGame(db, 'g-1', {
    name: 'Reclamation',
    mediatedBy: 'Rosa',
    members: [{ discordId: 'd-rosa', mediator: true, organizer: true }],
  })
  return db
}

describe('mine', () => {
  it('lists the Shelf and every Game’s units the caller may see, by kind', async () => {
    const db = await table()
    expect(await mine(db, rooms, 'd-rosa')).toEqual({
      ok: true,
      pilots: [{ id: 'p-rosa', body: ROSA_PILOT.body }],
      mechs: [{ id: 'm-shelf', body: SHELF_MECH.body }],
      crawlers: [{ id: 'c-1', body: CRAWLER.body }],
    })
  })

  it('refuses a Discord user no account carries', async () => {
    expect(await mine(await table(), rooms, 'd-nobody')).toMatchObject({ reason: 'unlinked' })
  })
})

describe('sheet', () => {
  it('reads the caller’s own Shelf unit under their name', async () => {
    const db = await table()
    expect(
      await sheet(db, rooms, { discordId: 'd-rosa', table: 'mechs', entityId: 'm-shelf' })
    ).toEqual({
      ok: true,
      table: 'mechs',
      id: 'm-shelf',
      appId: 'm-shelf',
      publicRead: false,
      ownerName: 'Rosa',
      body: SHELF_MECH.body,
      vitals: SHELF_VITALS,
    })
  })

  it('reads a crewmate’s sheet in a shared Game, naming them', async () => {
    const db = await table()
    expect(
      await sheet(db, rooms, { discordId: 'd-rosa', table: 'pilots', entityId: 'p-tam' })
    ).toMatchObject({ ok: true, ownerName: 'Tam', body: TAM_PILOT.body })
  })

  it('answers not-found for the wrong table and for a sheet out of reach', async () => {
    const db = await table()
    const ask = (discordId: string, entityId: string, t: 'pilots' | 'mechs' = 'pilots') =>
      sheet(db, rooms, { discordId, table: t, entityId })
    expect(await ask('d-rosa', 'p-tam', 'mechs')).toMatchObject({ message: SHEET_NOT_FOUND })
    expect(await ask('d-ines', 'p-tam')).toMatchObject({ message: SHEET_NOT_FOUND })
    expect(await ask('d-nobody', 'p-tam')).toMatchObject({ reason: 'unlinked' })
  })

  it('serves a published sheet to anyone, from its public page', async () => {
    const db = await table()
    await publish(db, 'account:d-tam', {
      sheets: [
        {
          kind: 'pilot',
          appId: 'p-tam',
          ownerId: 'd-tam',
          page: { kind: 'pilot', appId: 'p-tam', body: TAM_PILOT.body },
          preview: { kind: 'pilot', title: 'Tam', description: '' } as never,
        },
      ],
    })
    expect(
      await sheet(db, rooms, { discordId: 'd-nobody', table: 'pilots', entityId: 'p-tam' })
    ).toEqual({
      ok: true,
      table: 'pilots',
      id: 'p-tam',
      appId: 'p-tam',
      publicRead: true,
      ownerName: null,
      body: TAM_PILOT.body,
    })
    expect(
      await sheet(db, rooms, { discordId: 'd-rosa', table: 'pilots', entityId: 'p-tam' })
    ).toMatchObject({ publicRead: true, ownerName: 'Tam' })
  })
})
