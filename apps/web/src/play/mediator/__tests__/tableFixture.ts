/**
 * A table to run, for the Mediator's tests: board
 * M1's crew — Bonesaw on foot, Pickle boarded in an overheating Spectrum,
 * Judge ejected, Driftwood in Mazona — plus Hotdog, an unclaimed pre-gen who
 * is an open seat, not a card.
 */

import type { Id } from '../../../../convex/_generated/dataModel'
import { calm, crewMech, crewPilot, sound } from '../../__tests__/crewRows'
import type { BoardSources } from '../../boardMenu.model'
import type { CrewVitals } from '../../useGameFeed'

type Mech = CrewVitals['mechs'][number]

const pilot = crewPilot

/** A mech at SP 9/9, Heat 0/8, unless `over` says otherwise. */
function mech(id: string, name: string, owner: string | null, over: Partial<Mech> = {}): Mech {
  return crewMech(id, name, owner, { currentSP: 9, maxSP: 9, maxHeat: 8, ...over })
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
