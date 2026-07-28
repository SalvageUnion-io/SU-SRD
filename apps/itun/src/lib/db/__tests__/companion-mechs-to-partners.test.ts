/**
 * Unit tests for the v12 record rewrite (companion-mechs → partners).
 *
 * These pin the two halves of the classifier, which is where the risk lives: a
 * migration is the one edit a user cannot undo, so the rule must convert every
 * mech that IS a partner and refuse every mech that merely looks broken.
 *
 * The Eldridge Coast rows this exists for are the concrete cases — Rek Jet
 * (`chassisRef: 'auto-turret'`), Custos and PR-1 (`'survey-drone'`), Incitatus
 * (`'mecha-companion'`) — all of which shipped in the pre-#464 seed and are
 * still sitting in every browser that opened that workspace before the fix.
 */
import { describe, expect, test } from 'bun:test'

import {
  isCompanionMech,
  partnerFromCompanionMech,
} from '../migrations/12-companion-mechs-to-partners'

let counter = 0
const stableId = (): string => `partner-${++counter}`
const reset = (): void => {
  counter = 0
}

describe('isCompanionMech (v12 classifier)', () => {
  test.each([['auto-turret'], ['survey-drone'], ['mecha-companion']])(
    'accepts a mech whose chassisRef is the partner equipment slug %s',
    (slug) => {
      expect(isCompanionMech({ id: 'm1', name: 'X', chassisRef: slug })).toBe(true)
    }
  )

  test('rejects a genuine chassis', () => {
    expect(isCompanionMech({ id: 'm1', name: 'GOAT', chassisRef: 'atlas' })).toBe(false)
  })

  /**
   * The deliberate false negative. An unrecognised chassis is a mech we cannot
   * re-home without guessing, so it stays a (visibly broken) mech rather than
   * being silently converted or deleted.
   */
  test('rejects an unknown chassis it cannot classify', () => {
    expect(isCompanionMech({ id: 'm1', name: '?', chassisRef: 'not-a-real-thing' })).toBe(false)
  })

  test('rejects malformed records', () => {
    expect(isCompanionMech(null)).toBe(false)
    expect(isCompanionMech({ id: 'm1' })).toBe(false)
    expect(isCompanionMech({ id: 'm1', chassisRef: 42 })).toBe(false)
  })
})

describe('partnerFromCompanionMech (v12 conversion)', () => {
  test('carries name, loadout and conditions across', () => {
    reset()
    expect(
      partnerFromCompanionMech(
        {
          id: 'eldridge-mech-rek-jet',
          name: 'Rek Jet',
          chassisRef: 'auto-turret',
          patternName: 'Rek Jet',
          systems: ['red-laser', 'welding-laser'],
          modules: ['comms-module'],
          systemConditions: { 'red-laser': 'damaged' },
        },
        stableId
      )
    ).toEqual({
      id: 'partner-1',
      hostRef: 'auto-turret',
      hostSchema: 'equipment',
      name: 'Rek Jet',
      systems: ['red-laser', 'welding-laser'],
      modules: ['comms-module'],
      systemConditions: { 'red-laser': 'damaged' },
      conditions: [],
    })
  })

  /** `quirk` was the only free-text slot a companion-mech had, and it is what
   *  the A.I. personality was actually being written into. */
  test('rehomes quirk as the A.I. personality', () => {
    reset()
    const partner = partnerFromCompanionMech(
      {
        id: 'm',
        name: 'Rek Jet',
        chassisRef: 'auto-turret',
        quirk: 'Changes personality frequently',
        appearance: 'Bobblehead Head.',
      },
      stableId
    )
    expect(partner.aiPersonality).toBe('Changes personality frequently')
    expect(partner.appearance).toBe('Bobblehead Head.')
  })

  /** A partner has no chassis, so it has no pattern either. */
  test('drops patternName', () => {
    reset()
    const partner = partnerFromCompanionMech(
      { id: 'm', name: 'PR-1', chassisRef: 'survey-drone', patternName: 'PR-1' },
      stableId
    )
    expect(partner).not.toHaveProperty('patternName')
  })

  test('preserves live play state and cargo', () => {
    reset()
    const partner = partnerFromCompanionMech(
      {
        id: 'm',
        name: 'Custos',
        chassisRef: 'survey-drone',
        currentSP: 3,
        currentHeat: 2,
        cargoLots: [{ name: 'Scrap', units: 2 }],
      },
      stableId
    )
    expect(partner.currentSP).toBe(3)
    expect(partner.currentHeat).toBe(2)
    expect(partner.cargoLots).toEqual([{ name: 'Scrap', units: 2 }])
  })

  test('omits absent optional fields rather than writing empties', () => {
    reset()
    const partner = partnerFromCompanionMech({ id: 'm', chassisRef: 'survey-drone' }, stableId)
    expect(partner).toEqual({
      id: 'partner-1',
      hostRef: 'survey-drone',
      hostSchema: 'equipment',
      systems: [],
      modules: [],
      conditions: [],
    })
  })
})
