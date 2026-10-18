/**
 * MechSheet — a loadout the book prints over its chassis's slots reads
 * "as printed", not as a mistake (`computeMechCapacity`'s `asPrinted`).
 *
 * Manic Miner (Starter Set Parts Catalogue p.11) fills 14 of the 13 System
 * Slots the Bobcat prints (p.10). Real reference data: the chassis resolves
 * from `chassisRef`.
 */

import { describe, expect, mock, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { slabChip } from '../../../components/__tests__/slabChip'
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

function makeMech(systems: string[]): Mech {
  return {
    id: 'mech-as-printed-1',
    schemaVersion: 1,
    name: 'Manic Miner',
    patternName: 'Manic Miner',
    chassisRef: 'bobcat',
    systems,
    modules: ['comms-module', 'survey-scanner'],
    cargoLots: [],
    conditions: [],
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }
}

function renderSheet(mech: Mech) {
  const store = makeEntityStoreMock({
    mechs: [mech],
    get: mock(() => mech),
    list: mock(() => [mech]),
  })
  render(<MechSheet mech={mech} store={store} readOnly />)
}

describe('MechSheet — patterns printed over their slots', () => {
  test('the printed loadout reads as printed, with its cite', () => {
    renderSheet(makeMech(MANIC_MINER_SYSTEMS))
    const systems = must(slabChip('Systems'))
    expect(systems.textContent).toBe('Slots14/13')
    expect(systems.classList.contains('su-stat-cell--critical')).toBe(false)
    const noted = must(systems.parentElement)
    expect(noted.textContent).toBe('Slots14/13as printed')
    expect(noted.getAttribute('title')).toBe(
      'Manic Miner, Salvage Union Starter Set, Parts Catalogue p.11'
    )
    // Its modules fit, so they carry no note.
    expect(must(slabChip('Modules')).parentElement?.textContent).toBe('Slots2/2')
  })

  test('a loadout past the printed one is a plain over-slot count', () => {
    renderSheet(makeMech([...MANIC_MINER_SYSTEMS, 'cargo-pod']))
    const systems = must(slabChip('Systems'))
    expect(systems.textContent).toBe('Slots15/13')
    expect(systems.classList.contains('su-stat-cell--critical')).toBe(true)
    expect(screen.queryByText(/as printed/)).toBeNull()
  })
})
