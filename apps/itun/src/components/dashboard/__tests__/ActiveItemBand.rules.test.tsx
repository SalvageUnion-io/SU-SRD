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
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import type { PlayStore } from '../ActiveItemBand'
import { ActiveItemBand } from '../ActiveItemBand'

const mech = mechFixture({
  id: 'm1',
  name: 'Iron Mongrel',
  chassisRef: 'unknown-chassis',
  currentSP: 10,
})

const pilot = pilotFixture({ id: 'p1', name: 'Vesh', currentHP: 10 })

type Call = { type: string; id: string; patch: Record<string, unknown> }

function stubStore(entities: Array<Mech | Pilot>): { store: PlayStore; calls: Call[] } {
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
    fireEvent.click(screen.getByLabelText('Add one damage point'))
    fireEvent.click(screen.getByLabelText('Add one damage point'))
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

describe('blocked controls teach the rule (F6, ADR-021)', () => {
  // Guided Play "teaches as it enforces". A blocked Push used to grey out with a
  // hover title — unreachable on touch, and it taught nothing at the moment the
  // rule actually bit.
  const hotMech = mechFixture({
    id: 'm-hot',
    name: 'Iron Mongrel',
    chassisRef: 'unknown-chassis',
    currentSP: 10,
    // heatCapacity resolves to 0 for an unknown chassis, so any heat is over cap
    currentHeat: 0,
    maxHeatOverride: 4,
  })

  test('a Push that would exceed the Heat Cap explains itself instead of greying out', () => {
    const blocked = { ...hotMech, currentHeat: 3 } // 3 + 2 > 4
    const { store, calls } = stubStore([blocked])
    render(<ActiveItemBand mech={blocked} pilot={null} store={store} />)

    const push = screen.getByRole('button', { name: /push/i })
    expect(push.hasAttribute('disabled')).toBe(false)

    fireEvent.click(push)

    // It teaches rather than acting: the rule is shown and NOTHING is written.
    expect(screen.getByText(/Heat Cap/i)).toBeTruthy()
    expect(screen.getByText(/Quick Ref/i)).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  test('a legal Push still performs the action, not the explanation', () => {
    const ok = { ...hotMech, currentHeat: 0 } // 0 + 2 <= 4
    const { store, calls } = stubStore([ok])
    render(<ActiveItemBand mech={ok} pilot={null} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: /push/i }))

    expect(screen.queryByText(/Quick Ref/i)).toBeNull()
    expect(calls.length).toBeGreaterThan(0)
  })
})
