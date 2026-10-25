/**
 * A Game's crew as `crew.vitals` answers it, for Play's Crew tests: Mags
 * boarded in Atlas and here, Rook on foot, hurt (▲ HP 4) and here, Wren boarded
 * in Mule and away, and Bonesaw, the pilot the screen plays.
 */

import type { Id } from '../../../convex/_generated/dataModel'
import type { CrewVitals } from '../useGameFeed'
import { calm, sound } from './crewRows'

const pilot = {
  ownerId: null,
  ownerName: null,
  currentHP: null,
  currentAP: null,
  maxHP: 10,
  maxAP: 5,
  status: calm,
  attention: false,
}
const mech = {
  ownerId: null,
  ownerName: null,
  currentSP: null,
  currentEP: null,
  currentHeat: null,
  maxSP: 26,
  maxEP: 6,
  maxHeat: 9,
  status: sound,
  attention: false,
}

/** Who has the Game open: everyone but Wren's player. */
export const CREW_HERE: ReadonlySet<string> = new Set(['u-bonesaw', 'u-mags', 'u-rook'])

/** The crew, each pilot assigned to their own player. */
export function crewAt(): CrewVitals {
  return {
    viewerId: 'u-me' as Id<'users'>,
    pilots: [
      {
        ...pilot,
        _id: 'r-bonesaw' as Id<'pilots'>,
        appId: 'bonesaw',
        linkId: 'bonesaw',
        name: 'Bonesaw',
        boarded: false,
        mechId: null,
        ownerId: 'u-bonesaw' as Id<'users'>,
      },
      {
        ...pilot,
        _id: 'r-mags' as Id<'pilots'>,
        appId: 'mags',
        linkId: 'mags',
        name: 'Mags',
        boarded: true,
        mechId: 'atlas',
        ownerId: 'u-mags' as Id<'users'>,
      },
      {
        ...pilot,
        _id: 'r-rook' as Id<'pilots'>,
        appId: 'rook',
        linkId: 'rook',
        name: 'Rook',
        currentHP: 4,
        boarded: false,
        mechId: null,
        status: { ...calm, injured: true },
        attention: true,
        ownerId: 'u-rook' as Id<'users'>,
      },
      {
        ...pilot,
        _id: 'r-wren' as Id<'pilots'>,
        appId: 'wren',
        linkId: 'wren',
        name: 'Wren',
        boarded: true,
        mechId: 'mule',
        ownerId: 'u-wren' as Id<'users'>,
      },
    ],
    mechs: [
      {
        ...mech,
        _id: 'r-atlas' as Id<'mechs'>,
        appId: 'atlas',
        linkId: 'atlas',
        name: 'Atlas',
        currentSP: 22,
      },
      { ...mech, _id: 'r-mule' as Id<'mechs'>, appId: 'mule', linkId: 'mule', name: 'Mule' },
    ],
  }
}
