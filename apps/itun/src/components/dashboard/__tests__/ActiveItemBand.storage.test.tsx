/**
 * Tests for the Phase-7 cargo-hold overlay on the mech band: the Storage button
 * opens a hold listing the mech's cargo lots, and Jettison writes a cargoLots
 * patch with that lot removed (the explicit player-confirmed discard, ADR-007).
 */

import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { CargoLot } from '../../../lib/schemas/cargoLot'
import type { Mech } from '../../../lib/schemas/mech'
import { usePlayStateStore } from '../../../stores/playStateStore'
import { ActiveItemBand } from '../ActiveItemBand'
import type { PlayStore } from '../ActiveItemBand'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { mechFixture } from '../../__tests__/fixtures'

const lotA: CargoLot = {
  id: 'lot-a',
  kind: 'unit',
  name: 'Sealed Crate',
  cat: 'SEALED',
  units: 1,
  code: 'SEA',
}
const lotB: CargoLot = {
  id: 'lot-b',
  kind: 'bulk',
  name: 'Tech 3 Scrap',
  cat: 'SCRAP',
  tl: 3,
  qty: 4,
  units: 4,
  code: 'SCR-T3',
}

const mech = mechFixture({
  id: 'm1',
  name: 'Iron Mongrel',
  chassisRef: 'unknown-chassis',
  cargoLots: [lotA, lotB],
  currentSP: 10,
  // Deterministic cargo cap (unknown chassis contributes 0): used 5 / cap 6.
  maxCargoModifier: 6,
})

type Call = { type: string; id: string; patch: Record<string, unknown> }

function stubStore(entities: Mech[]): { store: PlayStore; calls: Call[] } {
  const calls: Call[] = []
  const store: PlayStore = makeEntityStoreMock({
    get: (_type, id) => entities.find((e) => e.id === id) ?? null,
    update: async (type, id, patch) => {
      calls.push({ type, id, patch })
      return entities.find((e) => e.id === id) ?? null
    },
  }).getState()
  return { store, calls }
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('ActiveItemBand cargo hold', () => {
  beforeEach(() => {
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
  })

  test('Storage opens the hold listing the cargo lots', () => {
    const { store } = stubStore([mech])
    render(<ActiveItemBand mech={mech} pilot={null} store={store} />)
    fireEvent.click(screen.getByText('Storage'))
    expect(screen.getByLabelText('Jettison Sealed Crate')).toBeTruthy()
    expect(screen.getByLabelText('Jettison Tech 3 Scrap')).toBeTruthy()
    expect(screen.getByText('Hold 5/6')).toBeTruthy()
  })

  test('Jettison writes cargoLots without the discarded lot', () => {
    const { store, calls } = stubStore([mech])
    render(<ActiveItemBand mech={mech} pilot={null} store={store} />)
    fireEvent.click(screen.getByText('Storage'))
    fireEvent.click(screen.getByLabelText('Jettison Sealed Crate'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ type: 'mech', id: 'm1', patch: { cargoLots: [lotB] } })
  })
})
