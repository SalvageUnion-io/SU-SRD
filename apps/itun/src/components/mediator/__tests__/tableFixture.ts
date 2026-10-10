/**
 * A table to run, for the Mediator Dashboard's tests and catalog story: board
 * M1's crew — Bonesaw on foot, Pickle boarded in an overheating Spectrum,
 * Judge ejected, Driftwood in Mazona — plus Hotdog, an unclaimed pre-gen who
 * is an open seat, not a card.
 */

import type { Id } from '../../../../convex/_generated/dataModel'
import type { BoardSources } from '../../dashboard/boardMenu'
import type { CrewVitals } from '../../dashboard/useGameFeed'

const calm = { dead: false, injured: false, ejected: false }
const sound = {
  destroyed: false,
  shutdown: false,
  overheating: false,
  destroyedSystems: [],
  destroyedModules: [],
}

type Pilot = CrewVitals['pilots'][number]
type Mech = CrewVitals['mechs'][number]

function pilot(id: string, name: string, owner: string | null, over: Partial<Pilot> = {}): Pilot {
  return {
    _id: `row-${id}` as Id<'pilots'>,
    appId: id,
    linkId: id,
    ownerId: owner as Id<'users'> | null,
    ownerName: owner,
    name,
    currentHP: 10,
    currentAP: 5,
    maxHP: 10,
    maxAP: 5,
    boarded: false,
    mechId: null,
    status: calm,
    attention: false,
    ...over,
  }
}

function mech(id: string, name: string, owner: string | null, over: Partial<Mech> = {}): Mech {
  return {
    _id: `row-${id}` as Id<'mechs'>,
    appId: id,
    linkId: id,
    ownerId: owner as Id<'users'> | null,
    ownerName: owner,
    name,
    currentSP: 9,
    currentEP: 6,
    currentHeat: 0,
    maxSP: 9,
    maxEP: 6,
    maxHeat: 8,
    status: sound,
    attention: false,
    ...over,
  }
}

export const TABLE_CREW: CrewVitals = {
  viewerId: 'u-gm' as Id<'users'>,
  pilots: [
    pilot('driftwood', 'Driftwood', 'u-ivo', { boarded: true, mechId: 'mazona' }),
    pilot('pickle', 'Pickle', 'u-teo', { boarded: true, mechId: 'spectrum', attention: true }),
    pilot('bonesaw', 'Bonesaw', 'u-rosa', { currentHP: 8, currentAP: 3, mechId: 'scrapper' }),
    pilot('judge', 'Judge', 'u-mags', {
      currentHP: 4,
      currentAP: 2,
      status: { ...calm, ejected: true },
      attention: true,
    }),
    pilot('hotdog', 'Hotdog', null),
  ],
  mechs: [
    mech('spectrum', 'Spectrum', 'u-teo', {
      currentSP: 6,
      currentHeat: 8,
      status: { ...sound, overheating: true },
      attention: true,
    }),
    mech('mazona', 'Mazona', 'u-ivo'),
    mech('scrapper', 'Scrapper', 'u-rosa'),
  ],
}

/** Pickle aboard Spectrum and Driftwood aboard Mazona, as the seats say. */
export const TABLE_SEATS: BoardSources['seats'] = [
  { pilotId: 'pickle', mount: { kind: 'boarded', mechId: 'spectrum' } },
  { pilotId: 'driftwood', mount: { kind: 'boarded', mechId: 'mazona' } },
  { pilotId: 'bonesaw', mount: { kind: 'foot' } },
  { pilotId: 'judge', mount: { kind: 'foot' } },
]

/** Join order: Rosa, Teo, Mags, Ivo — the order the cards keep. */
export const TABLE_MEMBERS = [
  { userId: 'u-gm', joinedAt: 0 },
  { userId: 'u-rosa', joinedAt: 1 },
  { userId: 'u-teo', joinedAt: 2 },
  { userId: 'u-mags', joinedAt: 3 },
  { userId: 'u-ivo', joinedAt: 4 },
]
