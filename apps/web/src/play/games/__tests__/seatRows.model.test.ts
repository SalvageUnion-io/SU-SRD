import { describe, expect, test } from 'bun:test'
import type { GameListing } from '../../../replica/gameListing'
import type { CrewVitals } from '../../../rooms/vitals'
import { pilotMechIds, seatRows } from '../seatRows.model'

const unit = (id: string, ownerId: string | null, body: Record<string, unknown>) => ({
  _id: id,
  appId: id,
  ownerId,
  body: { id, ...body },
})

/** Hotdog, a pregen, came with Mazona; Priya's Magpie took Mazona with Assign and board. */
const LISTING = {
  pilots: [
    unit('hotdog', null, { callsign: 'Hotdog' }),
    unit('magpie', 'priya', { callsign: 'Magpie' }),
  ],
  mechs: [unit('mazona', 'priya', { name: 'Mazona' })],
  crawlers: [],
  npcs: [],
  softLinks: [
    {
      id: 'l1',
      type: 'mech-to-pilot',
      from: { kind: 'mech', id: 'mazona' },
      to: { kind: 'pilot', id: 'hotdog' },
    },
  ],
  primaryCrawlerId: null,
} as unknown as GameListing

const VITALS = {
  pilots: [
    { _id: 'hotdog', boarded: false, mechId: 'mazona', maxHP: null, currentHP: null },
    { _id: 'magpie', boarded: true, mechId: 'mazona', maxHP: null, currentHP: null },
  ],
  mechs: [],
} as unknown as CrewVitals

const MEMBERS = [
  { userId: 'priya', displayName: 'Priya', mediator: false, joinedAt: 1 },
] as unknown as Parameters<typeof seatRows>[1]

// r8 C5 (LG8-09): one Mech, one line.
describe('a pregen’s spare Mech taken by another player', () => {
  test('rides its new Pilot’s seat, and leaves its old one', () => {
    const { rows } = seatRows(LISTING, MEMBERS, null, VITALS)
    const of = (who: string) => rows.find((r) => r.pilot?.name.startsWith(who))?.pilot?.mech
    expect(of('Magpie')).toBe('Mazona')
    expect(of('Hotdog')).toBeNull()
  })

  test('is its new Pilot’s, by id', () => {
    expect(pilotMechIds(LISTING, VITALS)).toEqual(
      new Map([
        ['hotdog', null],
        ['magpie', 'mazona'],
      ])
    )
  })
})
