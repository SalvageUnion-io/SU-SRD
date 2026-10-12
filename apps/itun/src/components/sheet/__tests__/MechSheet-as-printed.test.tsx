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
import type { Mech } from 'itun-domain/schemas/mech'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
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
    const systems = screen.getByText('14/13 slots · as printed')
    expect(systems.getAttribute('title')).toBe(
      'Manic Miner, Salvage Union Starter Set, Parts Catalogue p.11'
    )
    // Its modules fit, so they carry no note.
    expect(screen.getByText('2/2 slots')).toBeTruthy()
  })

  test('a loadout past the printed one is a plain over-slot count', () => {
    renderSheet(makeMech([...MANIC_MINER_SYSTEMS, 'cargo-pod']))
    expect(screen.getByText('15/13 slots')).toBeTruthy()
    expect(screen.queryByText(/as printed/)).toBeNull()
  })
})
