/**
 * MechSheet — unresolved chassis tests (#243, plan 4.5; Phase 2 poster regions)
 *
 * When chassis cannot be resolved (null), the body must still render — the
 * accessible alert names the bogus chassisRef, the Identity/Vitals poster
 * regions and the hold stay functional with zero-derived maxima, and
 * installed item slugs keep their cards/fallbacks.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const fakeMech: Mech = {
  id: 'mech-unresolved-1',
  schemaVersion: 1,
  name: 'Ghost Frame',
  chassisRef: 'nonexistent-chassis-xyz',
  systems: ['mystery-system'],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentSP: 5,
  currentEP: 4,
  currentHeat: 6,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeStubStore(mech: Mech): typeof useEntityStore {
  return makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),

    get: mock((_type: string, id: string) => (id === mech.id ? mech : null)),
    create: mock(async () => mech),
    update: mock(async () => mech),
    delete: mock(async () => {}),
  })
}

describe('MechSheet — unresolved chassis (chassis=null)', () => {
  test('shows accessible notice referencing the unresolvable chassisRef', () => {
    render(<MechSheet mech={fakeMech} chassis={null} store={makeStubStore(fakeMech)} />)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('nonexistent-chassis-xyz')
  })

  test('the body still renders: Identity/Vitals regions, item fallback, hold', () => {
    render(<MechSheet mech={fakeMech} chassis={null} store={makeStubStore(fakeMech)} />)

    // The identity band stays available (maxima derive to 0, never crash): its
    // fields and the SP vitals gauge render even with no chassis resolved.
    expect(screen.getByText(/pattern name/i)).toBeTruthy()
    expect(screen.getByText('Structure')).toBeTruthy()
    // The unresolvable system slug falls back to plain text.
    expect(screen.getByText('mystery-system')).toBeTruthy()
    // The Hold renders against a zero cargo cap.
    expect(screen.getByText(/the hold/i)).toBeTruthy()
    expect(screen.getByText('Hold empty.')).toBeTruthy()
  })

  test('no chassis-ability slab renders for an unknown chassis', () => {
    render(<MechSheet mech={fakeMech} chassis={null} store={makeStubStore(fakeMech)} />)

    expect(screen.queryByText(/chassis ability/i)).toBeNull()
  })
})
