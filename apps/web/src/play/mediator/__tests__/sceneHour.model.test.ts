/**
 * An hour under the Scene's conditions: who it asks something of, and what
 * it proposes them (Workshop Manual pp.305–306, False Flag p.9).
 */

import { describe, expect, test } from 'bun:test'
import { mediatorCrewAt } from '../../__tests__/mediatorFixture'
import { hourProposals, hourSteps } from '../sceneHour.model'

const crew = mediatorCrewAt()

describe('hourSteps', () => {
  test('in a Radiation Storm each boarded seat’s Mech is exposed, and a Pilot on foot', () => {
    const steps = hourSteps(['radiation-storm'], crew)
    expect(steps.map((s) => [s.label, s.exposed])).toEqual([
      ['Bonesaw’s Buzzard', 'mech'],
      ['Mags’s Atlas', 'mech'],
      ['Rook', 'pilot'],
      ['Wren’s Mule', 'mech'],
    ])
  })

  test('an unassigned pre-gen is no seat, and Irradiated asks nothing of a Pilot on foot hourly', () => {
    const steps = hourSteps(['irradiated'], crew)
    expect(steps.map((s) => s.label)).not.toContain('Rook')
    expect(steps.map((s) => s.label)).not.toContain('Hotdog')
  })

  test('a condition with nothing hourly asks nobody', () => {
    expect(hourSteps(['low-visibility'], crew)).toEqual([])
    expect(hourSteps(['radiation-storm'], null)).toEqual([])
  })
})

describe('hourProposals', () => {
  test('a Mech in the storm: SP −2 and Heat +2, from its own readings', () => {
    const buzzard = hourSteps(['radiation-storm'], crew)[0]
    if (buzzard === undefined) throw new Error('no Buzzard')
    expect(hourProposals(buzzard, 0, 'Radiation Storm, hour 1')).toEqual([
      {
        entityId: 'row-buzzard',
        entityType: 'mech',
        field: 'currentSP',
        after: 12,
        reason: 'Radiation Storm, hour 1',
      },
      {
        entityId: 'row-buzzard',
        entityType: 'mech',
        field: 'currentHeat',
        after: 5,
        reason: 'Radiation Storm, hour 1',
      },
    ])
  })

  test('Freezing: a Mech takes only what its roll does; a Pilot on foot 2 HP, never below 0', () => {
    const [buzzard, , rook] = hourSteps(['freezing'], crew)
    if (buzzard === undefined || rook === undefined) throw new Error('no seats')
    expect(hourProposals(buzzard, 0, 'Freezing, hour 1')).toEqual([])
    expect(hourProposals(buzzard, 1, 'Freezing, hour 1').map((p) => p.after)).toEqual([13])
    expect(hourProposals(rook, 0, 'Freezing, hour 1')).toEqual([
      {
        entityId: 'row-rook',
        entityType: 'pilot',
        field: 'currentHP',
        after: 2,
        reason: 'Freezing, hour 1',
      },
    ])
    expect(hourProposals(rook, 9, 'x')[0]?.after).toBe(0)
  })

  test('Heat stops at the Heat Cap', () => {
    const step = hourSteps(['radiation-storm', 'irradiated'], crew)[0]
    if (step === undefined) throw new Error('no step')
    const capped = { ...step, reading: { ...step.reading, heat: 9, heatCap: 10 } }
    expect(hourProposals(capped, 0, 'x').find((p) => p.field === 'currentHeat')?.after).toBe(10)
  })
})
