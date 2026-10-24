/**
 * Scene conditions: the Heat they scale and what an hour in them costs
 * (Workshop Manual pp.305–306, p.323; False Flag p.9).
 */

import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { canPush, performPush } from 'salvageunion-reference/rules'
import { SCENE_CONDITION_IDS } from '../../schemas/scene'
import {
  closeRangeOnly,
  freezingDamage,
  pushHeatAt,
  SCENE_CONDITIONS,
  scaleHeat,
  sceneConditionsOf,
  sceneConditionText,
  sceneHeatScale,
  sceneHourCost,
  sceneHourTables,
} from '../sceneConditions'

describe('sceneHeatScale', () => {
  test('a Radiation Storm doubles Heat gained and Freezing halves it', () => {
    expect(sceneHeatScale([])).toBe(1)
    expect(sceneHeatScale(['radiation-storm'])).toBe(2)
    expect(sceneHeatScale(['freezing'])).toBe(0.5)
    expect(sceneHeatScale(['radiation-storm', 'freezing'])).toBe(1)
  })

  test('an unknown id scales nothing', () => {
    expect(sceneHeatScale(['acid-rain'])).toBe(1)
  })
})

describe('scaleHeat', () => {
  test('rounds down (Core Book p.233)', () => {
    expect(scaleHeat(3, 0.5)).toBe(1)
    expect(scaleHeat(1, 0.5)).toBe(0)
    expect(scaleHeat(3, 2)).toBe(6)
  })

  test('a Push in a Radiation Storm is 4 Heat (p.306), Freezing 1', () => {
    expect(pushHeatAt(2)).toBe(4)
    expect(pushHeatAt(0.5)).toBe(1)
    expect(pushHeatAt(1)).toBe(2)
  })

  test('the scaled Push is what canPush and performPush take', () => {
    expect(canPush(7, 10)).toBe(true)
    expect(canPush(7, 10, pushHeatAt(2))).toBe(false)
    const { nextHeat } = performPush({
      heat: 3,
      heatCap: 10,
      currentSP: 10,
      roll: () => 20,
      gain: pushHeatAt(2),
    })
    expect(nextHeat).toBe(7)
  })
})

describe('sceneHourCost', () => {
  test('a Radiation Storm hour: 2 SP, 2 Heat and a Heat Check for a Mech', () => {
    expect(sceneHourCost(['radiation-storm'], 'mech')).toEqual({
      damage: 2,
      heat: 2,
      heatCheck: true,
      tables: [],
      injuries: [],
      from: ['Radiation Storm'],
    })
  })

  test('a Pilot on foot in a storm suffers a Major Injury, and takes no SP', () => {
    expect(sceneHourCost(['radiation-storm'], 'pilot')).toMatchObject({
      damage: 0,
      injuries: ['major'],
      from: ['Radiation Storm'],
    })
  })

  test('Freezing: the Mech rolls the table; a Pilot on foot takes 2 HP and a Minor Injury', () => {
    expect(sceneHourCost(['freezing'], 'mech')).toMatchObject({ tables: ['Freezing'] })
    expect(sceneHourCost(['freezing'], 'pilot')).toMatchObject({
      damage: 2,
      injuries: ['minor'],
    })
  })

  test('conditions add up; one that asks nothing of the unit is not named', () => {
    const cost = sceneHourCost(['irradiated', 'radiation-storm', 'low-visibility'], 'mech')
    expect(cost.heat).toBe(3)
    expect(cost.from).toEqual(['Radiation Storm', 'Irradiated'])
    expect(sceneHourCost(['irradiated'], 'pilot').from).toEqual([])
  })
})

describe('freezingDamage', () => {
  test('cold erosion is 1 SP on 11–19; the other rows damage a part or nothing', () => {
    expect([1, 5, 10, 11, 19, 20].map(freezingDamage)).toEqual([0, 0, 0, 1, 1, 0])
  })
})

describe('the rest of the catalogue', () => {
  test('the Anomalous Zone is the Mediator’s roll, once a Scene', () => {
    expect(sceneHourTables(['anomalous-zone', 'freezing'])).toEqual(['Anomalous Zone'])
  })

  test('a condition reads its rules text from its keyword, verbatim', () => {
    expect(sceneConditionText(SCENE_CONDITIONS['low-visibility'])).toEqual([
      'Pilots can only see and target at Close Range, unless they have other means of vision.',
    ])
    expect(sceneConditionText(SCENE_CONDITIONS['radiation-storm'])).toHaveLength(4)
  })

  test('Low Visibility limits targeting to Close', () => {
    expect(closeRangeOnly(['low-visibility'])).toBe(true)
    expect(closeRangeOnly(['radiation-storm'])).toBe(false)
  })

  test('conditions come back in catalogue order, once each', () => {
    expect(sceneConditionsOf(['freezing', 'radiation-storm', 'freezing']).map((c) => c.id)).toEqual(
      ['radiation-storm', 'freezing']
    )
  })

  test('every id has its entry, its keyword and its tables in the data', () => {
    for (const id of SCENE_CONDITION_IDS) {
      const c = SCENE_CONDITIONS[id]
      expect(c.id).toBe(id)
      expect(SalvageUnionReference.Keywords.getById(c.keyword)?.source).toBe(c.source)
      for (const table of [c.hour?.mechTable, c.hour?.table]) {
        if (table == null) continue
        expect(SalvageUnionReference.RollTables.getByName(table)).toBeDefined()
      }
    }
  })
})
