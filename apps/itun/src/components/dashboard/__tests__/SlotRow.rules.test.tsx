/**
 * Tests for the Phase-5 rules buttons in the Major slot — a stub store captures
 * every `update(...)` so we can assert the exact patch each handler writes
 * (deterministic controls only: Vent, Shutdown toggle, and self-declared SP/HP
 * damage; the d20-driven Push / Heat Check / Critical rolls are exercised in
 * dashboardRules.test.ts against an injected roller).
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import { mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import type { PlayStore } from '../SlotRow'
import { SlotRow } from '../SlotRow'
import { boardedSeat, fakeSeat } from './seatFixture'

/** The slot row's other inputs, which these tests don't vary. */
const ROW = {
  pilot: pilotFixture({ id: 'p-row', name: 'Vesh' }),
  crawler: null,
  mediator: false,
  onExpand: () => {},
}

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

/** Click a control whose write resolves before the band updates its own state. */
async function clickAndSettle(el: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(el)
  })
}

describe('Major slot rules buttons', () => {
  test('Vent writes Heat 0 + Vulnerable (no auto-shutdown; Vent ≠ Shutdown, dashboard.md §5.1)', async () => {
    const { store, calls } = stubStore([mech])
    render(
      <SlotRow
        {...ROW}
        mech={mech}
        mount="mech"
        boarded
        seat={boardedSeat(mech.id).handle}
        store={store}
      />
    )
    await clickAndSettle(screen.getByText('Vent'))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.patch).toEqual({ currentHeat: 0, vulnerable: true })
  })

  test('Shutdn toggles the shutdown flag', () => {
    const { store, calls } = stubStore([mech])
    render(
      <SlotRow
        {...ROW}
        mech={mech}
        mount="mech"
        boarded
        seat={boardedSeat(mech.id).handle}
        store={store}
      />
    )
    fireEvent.click(screen.getByText('Shutdn'))
    expect(calls[0]?.patch).toEqual({ shutdown: true })
  })

  test('Take Dmg applies the entered SP damage', async () => {
    const { store, calls } = stubStore([mech])
    render(
      <SlotRow
        {...ROW}
        mech={mech}
        mount="mech"
        boarded
        seat={boardedSeat(mech.id).handle}
        store={store}
      />
    )
    fireEvent.click(screen.getByText('Take Dmg'))
    // Bump damage 1 → 3, then apply.
    fireEvent.click(screen.getByLabelText('Add one damage point'))
    fireEvent.click(screen.getByLabelText('Add one damage point'))
    await clickAndSettle(screen.getByText('Apply −3 SP'))
    expect(calls[0]?.patch).toEqual({ currentSP: 7 })
  })

  test('pilot Take Dmg applies HP damage on foot', async () => {
    const { store, calls } = stubStore([mech, pilot])
    render(
      <SlotRow
        {...ROW}
        mech={mech}
        pilot={pilot}
        mount="pilot"
        boarded={false}
        seat={fakeSeat().handle}
        store={store}
      />
    )
    fireEvent.click(screen.getByText('Take Dmg'))
    await clickAndSettle(screen.getByText('Apply −1 HP'))
    expect(calls[0]).toEqual({ type: 'pilot', id: 'p1', patch: { currentHP: 9 } })
  })

  test('Eject requires an explicit confirm (ADR-007)', () => {
    const { store } = stubStore([mech, pilot])
    const seat = boardedSeat(mech.id)
    render(
      <SlotRow
        {...ROW}
        mech={mech}
        pilot={pilot}
        mount="mech"
        boarded
        seat={seat.handle}
        store={store}
      />
    )
    fireEvent.click(screen.getByText('Eject'))
    // Nothing reaches the seat until confirmed.
    expect(seat.calls).toEqual([])
    fireEvent.click(screen.getByText('Confirm Eject'))
    expect(seat.calls).toEqual([{ write: 'eject', args: [] }])
  })

  test('an activated effect is switched on the seat, and read back from it', () => {
    // "Squeeze it in" is a pilot ability with an activated contribution (ADR-029).
    const squeezer = { ...pilot, abilities: ['Squeeze it in'] }
    const { store } = stubStore([mech, squeezer])
    const off = boardedSeat(mech.id)
    const { unmount } = render(
      <SlotRow
        {...ROW}
        mech={mech}
        pilot={squeezer}
        mount="mech"
        boarded
        seat={off.handle}
        store={store}
      />
    )
    fireEvent.click(screen.getByText('○ Squeeze it in'))
    expect(off.calls).toEqual([{ write: 'toggleEffect', args: ['Squeeze it in'] }])
    unmount()

    const on = fakeSeat({
      mount: { kind: 'boarded', mechId: mech.id },
      activeEffects: ['Squeeze it in'],
    })
    render(
      <SlotRow
        {...ROW}
        mech={mech}
        pilot={squeezer}
        mount="mech"
        boarded
        seat={on.handle}
        store={store}
      />
    )
    expect(screen.getByText('● Squeeze it in')).toBeTruthy()
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
    render(
      <SlotRow
        {...ROW}
        mech={blocked}
        mount="mech"
        boarded
        seat={boardedSeat(blocked.id).handle}
        store={store}
      />
    )

    const push = screen.getByRole('button', { name: /push/i })
    expect(push.hasAttribute('disabled')).toBe(false)

    fireEvent.click(push)

    // It teaches rather than acting: the rule is shown and NOTHING is written.
    expect(screen.getByText(/Heat Cap/i)).toBeTruthy()
    expect(screen.getByText(/Quick Ref/i)).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  test('a legal Push still performs the action, not the explanation', async () => {
    const ok = { ...hotMech, currentHeat: 0 } // 0 + 2 <= 4
    const { store, calls } = stubStore([ok])
    render(
      <SlotRow
        {...ROW}
        mech={ok}
        mount="mech"
        boarded
        seat={boardedSeat(ok.id).handle}
        store={store}
      />
    )

    await clickAndSettle(screen.getByRole('button', { name: /push/i }))

    expect(screen.queryByText(/Quick Ref/i)).toBeNull()
    expect(calls.length).toBeGreaterThan(0)
  })
})
