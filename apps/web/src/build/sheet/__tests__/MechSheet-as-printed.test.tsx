/**
 * MechSheet — a loadout the book prints over its chassis's slots reads
 * "as printed", not as a mistake (`computeMechCapacity`'s `asPrinted`).
 *
 * Manic Miner (Starter Set Parts Catalogue p.11) fills 14 of the 13 System
 * Slots the Bobcat prints (p.10). Real reference data: the chassis resolves
 * from `chassisRef`.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { slabChip, slabCountCritical } from '../../../components/__tests__/slabChip'
import { mechRuleBreaks } from '../../../lib/rules/ruleBreaks'
import { MechSheet } from '../MechSheet'

const MANIC_MINER_SYSTEMS = [
  'locomotion-system',
  'mining-rig',
  'escape-hatch',
  'riveting-gun',
  'floodlights',
  'cargo-pod',
  'cargo-pod',
]

function makeMech(systems: string[], modules = ['comms-module', 'survey-scanner']): Mech {
  return {
    id: 'mech-as-printed-1',
    schemaVersion: 1,
    name: 'Manic Miner',
    startingPatternRef: 'manic-miner',
    chassisRef: 'bobcat',
    systems,
    modules,
    cargoLots: [],
    conditions: [],
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }
}

function renderSheet(mech: Mech) {
  const store = makeSingleUnitStore('mech', mech)
  render(<MechSheet mech={mech} store={store} readOnly />)
}

describe('MechSheet — patterns printed over their slots', () => {
  test('the printed loadout reads as printed, with its cite', () => {
    renderSheet(makeMech(MANIC_MINER_SYSTEMS))
    const systems = must(slabChip('Systems'))
    // The rule head's tally and its note, one count, with the printing on hover.
    expect(systems.textContent).toBe('14/13Slotsas printed')
    expect(slabCountCritical(systems)).toBe(false)
    expect(systems.getAttribute('title')).toBe(
      'Manic Miner, Salvage Union Starter Set, Parts Catalogue p.11'
    )
    // Its modules fit, so they carry no note.
    expect(must(slabChip('Modules')).textContent).toBe('2/2Slots')
  })

  test('a loadout past the printed one is a plain over-slot count', () => {
    renderSheet(makeMech([...MANIC_MINER_SYSTEMS, 'cargo-pod']))
    const systems = must(slabChip('Systems'))
    expect(systems.textContent).toBe('15/13Slots')
    expect(slabCountCritical(systems)).toBe(true)
    expect(screen.queryByText(/as printed/)).toBeNull()
  })

  test('editing the Modules leaves the untouched Systems line as printed (r4 E16)', () => {
    const mech = makeMech(MANIC_MINER_SYSTEMS, ['comms-module', 'survey-scanner', 'comms-module'])
    renderSheet(mech)
    const systems = must(slabChip('Systems'))
    expect(systems.textContent).toBe('14/13Slotsas printed')
    expect(slabCountCritical(systems)).toBe(false)
    // The edited line is counted as any loadout's, and only it breaks a rule.
    expect(slabCountCritical(must(slabChip('Modules')))).toBe(true)
    expect(mechRuleBreaks(mech).map((b) => b.stat)).toEqual(['moduleSlots'])
  })
})
