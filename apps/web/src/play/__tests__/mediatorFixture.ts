/**
 * The Mediator's table for Play's Mediator tests:
 * Bonesaw boarded in Buzzard and rolling, Mags boarded in Atlas, Rook on foot
 * and hurt (▲ HP 4/10), all three here; Wren boarded in Mule and away; and
 * Hotdog, an unassigned pre-gen, who is no seat.
 */

import type { CrewVitals } from '../useGameFeed'
import { calm, crewMech, crewPilot } from './crewRows'

const pilot = crewPilot
const mech = crewMech

/** Who has the Game open: everyone but Wren's player. */
export const TABLE_HERE: ReadonlySet<string> = new Set(['u-bonesaw', 'u-mags', 'u-rook'])

/** The table. */
export function mediatorCrewAt(): CrewVitals {
  return {
    pilots: [
      pilot('bonesaw', 'Bonesaw', 'u-bonesaw', {
        currentHP: 7,
        currentAP: 3,
        boarded: true,
        mechId: 'buzzard',
      }),
      pilot('mags', 'Mags', 'u-mags', {
        currentHP: 9,
        boarded: true,
        mechId: 'atlas',
      }),
      pilot('rook', 'Rook', 'u-rook', {
        currentHP: 4,
        currentAP: 1,
        status: { ...calm, injured: true },
        attention: true,
      }),
      pilot('wren', 'Wren', 'u-wren', { boarded: true, mechId: 'mule' }),
      pilot('hotdog', 'Hotdog', null, {}),
    ],
    mechs: [
      mech('buzzard', 'Buzzard', 'u-bonesaw', { currentSP: 14, currentEP: 4, currentHeat: 3 }),
      mech('atlas', 'Atlas', 'u-mags', { currentSP: 22, maxSP: 26, currentEP: 5, maxEP: 5 }),
      mech('mule', 'Mule', 'u-wren'),
    ],
  }
}

/** The Game's members, in the order they joined. */
export const MEDIATOR_MEMBERS = [
  { userId: 'u-gm', displayName: 'GM', mediator: true, organizer: true, joinedAt: 1 },
  { userId: 'u-bonesaw', displayName: 'Rosa', mediator: false, organizer: false, joinedAt: 2 },
  { userId: 'u-mags', displayName: 'Mags', mediator: false, organizer: false, joinedAt: 3 },
  { userId: 'u-rook', displayName: 'Teo', mediator: false, organizer: false, joinedAt: 4 },
  { userId: 'u-wren', displayName: 'Ivo', mediator: false, organizer: false, joinedAt: 5 },
]

/** The seats: Bonesaw is part-way through his cannon. */
export const MEDIATOR_SEATS = [
  {
    pilotId: 'bonesaw',
    mount: { kind: 'boarded' as const, mechId: 'buzzard' },
    resolving: {
      ref: 'system:120mm-cannon:0',
      name: '120mm Cannon',
      activated: true,
      applied: false,
    },
  },
]
