/**
 * Tests for the Phase-5 rules buttons on ActiveItemBand — a stub store captures
 * every `update(...)` so we can assert the exact patch each handler writes
 * (deterministic controls only: Vent, Shutdown toggle, and self-declared SP/HP
 * damage; the d20-driven Push / Heat Check / Critical rolls are exercised in
 * dashboardRules.test.ts against an injected roller).
 */

import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { usePlayStateStore } from '../../../stores/playStateStore'
import { ActiveItemBand } from '../ActiveItemBand'
import type { PlayStore } from '../ActiveItemBand'

const mech = {
  id: 'm1',
  name: 'Iron Mongrel',
  chassisRef: 'unknown-chassis',
  systems: [],
  modules: [],
  cargoLots: [],
  currentSP: 10,
} as unknown as Mech

const pilot = {
  id: 'p1',
  name: 'Vesh',
  abilities: [],
  equipment: [],
  conditions: [],
  currentHP: 10,
} as unknown as Pilot

type Call = { type: string; id: string; patch: Record<string, unknown> }

function stubStore(entities: Array<Mech | Pilot>): { store: PlayStore; calls: Call[] } {
  const calls: Call[] = []
  const store = {
    get: (_type: string, id: string) => entities.find((e) => e.id === id) ?? null,
    update: async (type: string, id: string, patch: Record<string, unknown>) => {
      calls.push({ type, id, patch })
      return entities.find((e) => e.id === id)
    },
  } as unknown as PlayStore
  return { store, calls }
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('ActiveItemBand rules buttons', () => {
  beforeEach(() => {
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
  })

  test('Vent writes Heat 0 + Vulnerable (no auto-shutdown; Vent ≠ Shutdown, plan §5.1)', () => {
    const { store, calls } = stubStore([mech])
    render(<ActiveItemBand mech={mech} pilot={null} store={store} />)
    fireEvent.click(screen.getByText('Vent'))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.patch).toEqual({ currentHeat: 0, vulnerable: true })
  })

  test('Shutdn toggles the shutdown flag', () => {
    const { store, calls } = stubStore([mech])
    render(<ActiveItemBand mech={mech} pilot={null} store={store} />)
    fireEvent.click(screen.getByText('Shutdn'))
    expect(calls[0]?.patch).toEqual({ shutdown: true })
  })

  test('Take Dmg applies the entered SP damage', () => {
    const { store, calls } = stubStore([mech])
    render(<ActiveItemBand mech={mech} pilot={null} store={store} />)
    fireEvent.click(screen.getByText('Take Dmg'))
    // Bump damage 1 → 3, then apply.
    fireEvent.click(screen.getByLabelText('Increase damage'))
    fireEvent.click(screen.getByLabelText('Increase damage'))
    fireEvent.click(screen.getByText('Apply −3 SP'))
    expect(calls[0]?.patch).toEqual({ currentSP: 7 })
  })

  test('pilot Take Dmg applies HP damage after Dismount', () => {
    const { store, calls } = stubStore([mech, pilot])
    render(<ActiveItemBand mech={mech} pilot={pilot} store={store} />)
    fireEvent.click(screen.getByText('Dismount'))
    fireEvent.click(screen.getByText('Take Dmg'))
    fireEvent.click(screen.getByText('Apply −1 HP'))
    expect(calls[0]).toEqual({ type: 'pilot', id: 'p1', patch: { currentHP: 9 } })
  })

  test('Eject requires an explicit confirm (ADR-007)', () => {
    const { store } = stubStore([mech, pilot])
    render(<ActiveItemBand mech={mech} pilot={pilot} store={store} />)
    fireEvent.click(screen.getByText('Eject'))
    // Still boarded until confirmed.
    expect(usePlayStateStore.getState().mount).toBe('mech')
    fireEvent.click(screen.getByText('Confirm Eject'))
    expect(usePlayStateStore.getState().mount).toBe('pilot')
  })
})
