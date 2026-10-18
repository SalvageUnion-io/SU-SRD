/**
 * The Units column's pure half (play.md §4): the live rules, the Downtime
 * restore preview, the crawler's bay chips and the hangar.
 */

import { describe, expect, test } from 'bun:test'
import { downtimeGuideSteps } from 'game-domain/rules/downtime'
import { crawlerFixture, mechFixture } from '../../components/__tests__/fixtures'
import type { BoardOption } from '../boardMenu.model'
import {
  bayChips,
  hangarMechs,
  mechRestorePreview,
  nudge,
  RESTORE_STEP_NAME,
  unitLiveness,
} from '../units.model'

const RESTORE_STEP = downtimeGuideSteps().findIndex((s) => s.name === RESTORE_STEP_NAME)

const ALL_HELD = { canWrite: true, mechHeld: true, crawlerHeld: true } as const

describe('unitLiveness (play.md §4)', () => {
  test('the pilot is always live; the mech only while Boarded', () => {
    for (const situation of ['onFoot', 'boarded', 'downtime'] as const) {
      const live = unitLiveness({ situation, solo: false, mediator: false, ...ALL_HELD })
      expect(live.pilot).toBe(true)
      expect(live.mech).toBe(situation === 'boarded')
    }
  })

  test('the crawler: in solo Downtime, or always for the Mediator; never a player’s in a Game', () => {
    const at = (solo: boolean, mediator: boolean, situation: 'onFoot' | 'downtime') =>
      unitLiveness({ situation, solo, mediator, ...ALL_HELD }).crawler
    expect(at(true, false, 'downtime')).toBe(true)
    expect(at(true, false, 'onFoot')).toBe(false)
    expect(at(false, false, 'downtime')).toBe(false)
    expect(at(false, true, 'onFoot')).toBe(true)
    expect(at(false, true, 'downtime')).toBe(true)
  })

  test('nothing is live offline, or when the store does not hold the unit', () => {
    expect(
      unitLiveness({
        situation: 'boarded',
        solo: true,
        mediator: true,
        ...ALL_HELD,
        canWrite: false,
      })
    ).toEqual({ pilot: false, mech: false, crawler: false })
    const notHeld = unitLiveness({
      situation: 'boarded',
      solo: false,
      mediator: true,
      canWrite: true,
      mechHeld: false,
      crawlerHeld: false,
    })
    expect(notHeld).toEqual({ pilot: true, mech: false, crawler: false })
  })
})

describe('mechRestorePreview (play.md §6)', () => {
  const worn = mechFixture({
    id: 'm-worn',
    chassisRef: 'mule',
    currentSP: 5,
    currentEP: 1,
    currentHeat: 3,
  })

  test('on "Restore your Mech & Pilot", SP and EP to full and Heat to 0', () => {
    expect(RESTORE_STEP).toBeGreaterThanOrEqual(0)
    const crawler = crawlerFixture({
      id: 'c',
      techLevel: 'tech-2',
      crawlerBays: [{ bayRef: 'mech-bay' }],
    })
    expect(mechRestorePreview(worn, crawler, RESTORE_STEP)).toEqual({ sp: 12, ep: 4, heat: 0 })
  })

  test('any other step, or no Downtime, restores nothing', () => {
    expect(mechRestorePreview(worn, null, RESTORE_STEP + 1)).toEqual({})
    expect(mechRestorePreview(worn, null, null)).toEqual({})
  })

  test('a damaged Mech Bay restores nothing (p.221)', () => {
    const crawler = crawlerFixture({
      id: 'c',
      crawlerBays: [{ bayRef: 'mech-bay', condition: 'damaged' }],
    })
    expect(mechRestorePreview(worn, crawler, RESTORE_STEP)).toEqual({})
  })

  test('a mech already whole has nothing to restore', () => {
    const whole = mechFixture({ id: 'm', chassisRef: 'mule', currentSP: 12, currentEP: 4 })
    expect(mechRestorePreview(whole, null, RESTORE_STEP)).toEqual({})
  })
})

describe('bayChips', () => {
  test('damaged bays first, three shown, the rest as +N', () => {
    const crawler = crawlerFixture({
      id: 'c',
      crawlerBays: [
        { bayRef: 'mech-bay' },
        { bayRef: 'med-bay' },
        { bayRef: 'storage-bay' },
        { bayRef: 'pilot-bay', condition: 'damaged' },
        { bayRef: 'trading-bay' },
      ],
    })
    expect(bayChips(crawler)).toEqual({
      chips: [
        { name: 'Pilot Bay', damaged: true },
        { name: 'Mech Bay', damaged: false },
        { name: 'Med Bay', damaged: false },
      ],
      more: 2,
    })
  })

  test('a crawler with no bays has no chips', () => {
    expect(bayChips(crawlerFixture({ id: 'c' }))).toEqual({ chips: [], more: 0 })
  })
})

describe('hangarMechs', () => {
  const option = (mechId: string, state: BoardOption['state']): BoardOption => ({
    mechId,
    serverId: null,
    name: mechId,
    state,
    note: null,
  })

  test('the pilot’s own mechs and destroyed ones, less the one shown', () => {
    const options = [
      option('shown', 'yours'),
      option('old-faithful', 'yours'),
      option('crewmate', 'others'),
      option('spare', 'spare'),
      option('aboard', 'aboard'),
      option('wreck', 'destroyed'),
    ]
    expect(hangarMechs(options, 'shown').map((o) => o.mechId)).toEqual(['old-faithful', 'wreck'])
  })
})

describe('nudge', () => {
  test('one step, held to 0…max', () => {
    expect(nudge(3, 1, 5)).toBe(4)
    expect(nudge(5, 1, 5)).toBe(5)
    expect(nudge(0, -1, 5)).toBe(0)
  })
})
