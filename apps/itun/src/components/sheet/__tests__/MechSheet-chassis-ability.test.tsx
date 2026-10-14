/**
 * MechSheet — the chassis ability is drawn as the SRD's chassis page draws it:
 * its Card, `[(CHASSIS)]` reading the chassis's name (EDL E19: never a Token
 * or a Peek).
 */

import { describe, expect, mock, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { Mech } from 'itun-domain/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { MechSheet } from '../MechSheet'

const mule: Mech = {
  id: 'mech-mule-1',
  schemaVersion: 1,
  name: 'Hauler',
  chassisRef: 'mule',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentSP: 12,
  currentEP: 4,
  currentHeat: 0,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

function makeStubStore(mech: Mech): typeof useEntityStore {
  return makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: false, npcs: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((_type: string, id: string) => (id === mech.id ? mech : null)),
    create: mock(async () => mech),
    update: mock(async () => mech),
    delete: mock(async () => {}),
  })
}

describe('MechSheet — chassis ability', () => {
  test('is a Card naming the chassis, never a Token', () => {
    render(<MechSheet mech={mule} store={makeStubStore(mule)} readOnly />)

    const region = screen.getByRole('region', { name: 'Chassis ability' })
    expect(region.querySelector('.su-entity-token')).toBeNull()
    expect(region.textContent).toContain('Integrated Cargo Bay')
    expect(region.textContent).toContain('The Mule')
    expect(region.textContent).not.toContain('[(CHASSIS)]')
  })
})
