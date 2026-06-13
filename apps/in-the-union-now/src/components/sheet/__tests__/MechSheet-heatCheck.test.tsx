/**
 * MechSheet — Heat Check / Reactor Overload UI tests (Slice C, #199).
 *
 * The d20 is injected via the `roll` prop (deterministic — no real randomness).
 * Covers: a passing Heat Check, an overload that overheats (SP damage + shutdown
 * applied via store.update), the player-choice prompt on a 2-5 band, and that
 * readOnly suppresses the roll controls + mutation.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injection not mock.module().
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import type { Roll } from '../../../lib/rules/heatCheck'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

// The body resolves chassis/cargo caps against the reference ORM at render.
beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const fakeMech: Mech = {
  id: 'mech-heat-1',
  schemaVersion: 1,
  name: 'Heat Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentHP: 12,
  currentSP: 10,
  currentHeat: 6,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 12,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 3,
  moduleSlots: 2,
  cargoCapacity: 4,
}

type CapturedUpdate = { id: string; patch: Partial<Mech> }

function makeStore(mech: Mech, captured: CapturedUpdate[]): typeof useEntityStore {
  let current = mech
  const updateMock = mock(async (_type: string, id: string, patch: Partial<Mech>) => {
    captured.push({ id, patch })
    current = { ...current, ...patch }
    return current
  })
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),

    get: mock(
      (_type: string, id: string) => (id === current.id ? current : null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => mech) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

/** Returns a Roll yielding the scripted values in order. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => values[i++] ?? values[values.length - 1] ?? 1
}

function clickButtonByText(text: string) {
  const btn = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.trim().toLowerCase().includes(text.toLowerCase()))
  if (!btn) throw new Error(`button "${text}" not found`)
  return btn
}

describe('MechSheet — Heat Check UI', () => {
  test('passing Heat Check records result, no SP/shutdown change', async () => {
    const captured: CapturedUpdate[] = []
    // heat 6, roll 12 > 6 → pass
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStore(fakeMech, captured)}
        roll={seqRoll(12)}
      />
    )

    await act(async () => {
      fireEvent.click(clickButtonByText('Heat Check'))
    })

    expect(captured.length).toBe(1)
    const patch = captured[0]!.patch
    expect(patch.lastHeatCheck?.overloaded).toBe(false)
    expect(patch.lastHeatCheck?.heatCheckRoll).toBe(12)
    expect(patch.currentSP).toBeUndefined()
    expect(patch.shutdown).toBeUndefined()
  })

  test('overload → overheat applies SP damage = heat + shutdown/vulnerable', async () => {
    const captured: CapturedUpdate[] = []
    // heat 6, check roll 3 <= 6 overload, overload roll 15 → overheat
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStore(fakeMech, captured)}
        roll={seqRoll(3, 15)}
      />
    )

    await act(async () => {
      fireEvent.click(clickButtonByText('Heat Check'))
    })

    const patch = captured[0]!.patch
    expect(patch.lastHeatCheck?.outcome).toBe('overheat')
    expect(patch.currentSP).toBe(4) // 10 - 6
    expect(patch.shutdown).toBe(true)
    expect(patch.vulnerable).toBe(true)
  })

  test('overload 2-5 prompts player to mark a System (no auto SP/flags)', async () => {
    const captured: CapturedUpdate[] = []
    // heat 6, check roll 2 <= 6 overload, overload roll 3 → system-destroyed
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStore(fakeMech, captured)}
        roll={seqRoll(2, 3)}
      />
    )

    await act(async () => {
      fireEvent.click(clickButtonByText('Heat Check'))
    })

    const patch = captured[0]!.patch
    expect(patch.lastHeatCheck?.outcome).toBe('system-destroyed')
    expect(patch.currentSP).toBeUndefined()
    expect(patch.shutdown).toBeUndefined()
    // Advisory prompt visible
    expect(screen.getByText(/Mark one System as Destroyed/i)).toBeTruthy()
  })

  test('Push adds 2 heat then performs a Heat Check', async () => {
    const captured: CapturedUpdate[] = []
    // heat 6 +2 = 8 (cap 8). Check roll 12 > 8 → pass.
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStore(fakeMech, captured)}
        roll={seqRoll(12)}
      />
    )

    await act(async () => {
      fireEvent.click(clickButtonByText('Push'))
    })

    const patch = captured[0]!.patch
    expect(patch.currentHeat).toBe(8)
    expect(patch.lastHeatCheck?.heatAtCheck).toBe(8)
    expect(patch.lastHeatCheck?.overloaded).toBe(false)
  })

  test('readOnly: no Heat Check / Push buttons, no mutation', async () => {
    const captured: CapturedUpdate[] = []
    render(
      <MechSheet
        mech={fakeMech}
        chassis={fakeChassis}
        store={makeStore(fakeMech, captured)}
        roll={seqRoll(1, 1)}
        readOnly
      />
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(captured.length).toBe(0)
  })
})

describe('MechSheet — manual flag clears (gap 8)', () => {
  test('Clear shutdown patches shutdown:false (vulnerable untouched)', async () => {
    const captured: CapturedUpdate[] = []
    const shutdownMech: Mech = {
      ...fakeMech,
      shutdown: true,
      vulnerable: true,
    }
    render(
      <MechSheet
        mech={shutdownMech}
        chassis={fakeChassis}
        store={makeStore(shutdownMech, captured)}
      />
    )

    expect(screen.getByText(/shut down/i)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /clear shutdown/i }))
    })

    expect(captured.length).toBe(1)
    expect(captured[0]!.patch).toEqual({ shutdown: false })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /clear vulnerable/i }))
    })
    expect(captured[1]!.patch).toEqual({ vulnerable: false })
  })

  test('Clear destroyed un-bricks the mech', async () => {
    const captured: CapturedUpdate[] = []
    const deadMech: Mech = { ...fakeMech, destroyed: true }
    render(
      <MechSheet mech={deadMech} chassis={fakeChassis} store={makeStore(deadMech, captured)} />
    )

    expect(screen.getByText(/mech destroyed/i)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /clear destroyed/i }))
    })

    expect(captured[0]!.patch).toEqual({ destroyed: false })
  })
})
