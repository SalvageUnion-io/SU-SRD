/**
 * `crew.vitals` rows for Play's crew fixtures (`crewFixture`, `mediatorFixture`,
 * `mediator/__tests__/tableFixture`): a pilot with nothing wrong and a mech
 * with nothing broken, each fixture keeping only its own crew.
 */

import type { Id } from '../../../../convex/_generated/dataModel'
import type { CrewVitals } from '../useGameFeed'

type Pilot = CrewVitals['pilots'][number]
type Mech = CrewVitals['mechs'][number]

/** A pilot's status with nothing wrong. */
export const calm = { dead: false, injured: false, ejected: false }

/** A mech's status with nothing broken. */
export const sound = {
  destroyed: false,
  shutdown: false,
  overheating: false,
  destroyedSystems: [],
  destroyedModules: [],
}

/** A pilot on foot at HP 10/10, AP 5/5, unless `over` says otherwise. */
export function crewPilot(
  id: string,
  name: string,
  owner: string | null,
  over: Partial<Pilot> = {}
): Pilot {
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
    lastSeenAt: null,
    ...over,
  }
}

/** A mech at SP 20/20, EP 6/6, Heat 0/10, unless `over` says otherwise. */
export function crewMech(
  id: string,
  name: string,
  owner: string | null,
  over: Partial<Mech> = {}
): Mech {
  return {
    _id: `row-${id}` as Id<'mechs'>,
    appId: id,
    linkId: id,
    ownerId: owner as Id<'users'> | null,
    ownerName: owner,
    name,
    currentSP: 20,
    currentEP: 6,
    currentHeat: 0,
    maxSP: 20,
    maxEP: 6,
    maxHeat: 10,
    status: sound,
    attention: false,
    ...over,
  }
}
