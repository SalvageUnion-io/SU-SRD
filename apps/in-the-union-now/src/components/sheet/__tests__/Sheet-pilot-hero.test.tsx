/**
 * Pilot hero on the LiveSheet shell (plan 4.4, design §4.2)
 *
 * Replaces the old PilotSheet-editable body-stat tests: HP/AP/TP now live as
 * hero StatBlock trackers wired straight to the entity store.
 *
 * Asserts that:
 *   1. HP/AP steppers persist currentHP/currentAP via store.update.
 *   2. Maxima are DERIVED: injuries lower max HP (10 + mod − Σ injuries).
 *   3. TP is an unbounded counter (no max readout) persisting trainingPoints.
 *   4. Used-toggles (background/motto/keepsake) render as chips in the
 *      identity block and persist usedToggles.
 *   5. Dead state (derived max HP ≤ 0) surfaces a Dead pill + KIA banner.
 *   6. readOnly suppresses steppers, used-toggle buttons and all writes.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-hero-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'scavenger',
    abilities: [],
    equipment: [],
    rollResults: [],
    motto: 'Waste not.',
    keepsake: 'A bent coin.',
    appearance: '',
    background: 'Union-born.',
    conditions: [],
    currentHP: 10,
    currentAP: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeStubStore(pilot: Pilot, updateSpy?: ReturnType<typeof mock>): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => pilot)
  const storeState = {
    pilots: [pilot],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => (id === pilot.id ? pilot : null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => pilot) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

function makeEntityStore(pilot: Pilot): EntityLookup {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (_type, id) => (id === pilot.id ? pilot : null) as any,
  }
}

function makeSoftLinkStore(): SoftLinkStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMock = mock(async () => undefined) as any
  return {
    softLinks: [],
    create: createMock,
    delete: mock(async () => undefined),
  }
}

function renderHero(pilot: Pilot, updateSpy?: ReturnType<typeof mock>, readOnly = false) {
  return render(
    <Sheet
      kind="pilot"
      id={pilot.id}
      entityStore={makeEntityStore(pilot)}
      softLinkStore={makeSoftLinkStore()}
      store={makeStubStore(pilot, updateSpy)}
      readOnly={readOnly}
    />
  )
}

// ---------------------------------------------------------------------------
// HP / AP trackers
// ---------------------------------------------------------------------------

describe('Pilot hero — HP/AP trackers', () => {
  test('HP tracker shows current of derived max (base 10)', () => {
    renderHero(makePilot({ currentHP: 7 }))
    expect(screen.getByRole('group', { name: 'HP 7 of 10' })).toBeTruthy()
  })

  test('decreasing HP persists currentHP', async () => {
    const pilot = makePilot({ currentHP: 7 })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decrease HP' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentHP: 6 })
  })

  test('increasing AP persists currentAP (clamped to derived max 5)', async () => {
    const pilot = makePilot({ currentAP: 4 })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase AP' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, { currentAP: 5 })
  })

  test('injuries lower the derived max HP (10 − 1 minor − 2 major = 7)', () => {
    renderHero(
      makePilot({
        currentHP: 10,
        injuries: [
          { severity: 'minor', note: 'sprain' },
          { severity: 'major', note: 'shrapnel' },
        ],
      })
    )
    // current clamps to the derived max for display
    expect(screen.getByRole('group', { name: 'HP 7 of 7' })).toBeTruthy()
  })

  test('maxHpModifier raises the derived max', () => {
    renderHero(makePilot({ currentHP: 12, maxHpModifier: 2 }))
    expect(screen.getByRole('group', { name: 'HP 12 of 12' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// TP tracker
// ---------------------------------------------------------------------------

describe('Pilot hero — TP tracker', () => {
  test('TP renders without a max (unbounded counter)', () => {
    renderHero(makePilot({ trainingPoints: 2 }))
    expect(screen.getByRole('group', { name: 'TP 2' })).toBeTruthy()
  })

  test('increasing TP persists trainingPoints', async () => {
    const pilot = makePilot({ trainingPoints: 2 })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase TP' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      trainingPoints: 3,
    })
  })
})

// ---------------------------------------------------------------------------
// Used-toggles in the identity block (rules A8–A10)
// ---------------------------------------------------------------------------

describe('Pilot hero — identity used-toggles', () => {
  test('marking the motto used persists usedToggles', async () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark motto used' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      usedToggles: { motto: true },
    })
  })

  test('resetting a used flag merges with existing flags', async () => {
    const pilot = makePilot({ usedToggles: { motto: true, keepsake: true } })
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset motto used' }))
    })

    expect(updateSpy).toHaveBeenCalledWith('pilot', pilot.id, {
      usedToggles: { motto: false, keepsake: true },
    })
  })

  test('readOnly: no toggle buttons, set flags render as static stamps', () => {
    renderHero(makePilot({ usedToggles: { background: true } }), undefined, true)

    expect(screen.queryByRole('button', { name: /mark .* used/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /reset .* used/i })).toBeNull()
    expect(screen.getAllByText('Used').length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Dead state (rules A2: derived max HP ≤ 0)
// ---------------------------------------------------------------------------

const DEAD_INJURIES: Pilot['injuries'] = [
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
  { severity: 'major', note: '' },
]

describe('Pilot hero — dead state', () => {
  test('derived max HP 0 surfaces the Dead pill and KIA banner', () => {
    renderHero(makePilot({ injuries: DEAD_INJURIES }))

    expect(screen.getAllByText('Dead').length).toBeGreaterThan(0)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/killed in action/i)).toBeTruthy()
  })

  test('living pilot shows neither', () => {
    renderHero(makePilot())
    expect(screen.queryByText('Dead')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// readOnly
// ---------------------------------------------------------------------------

describe('Pilot hero — readOnly', () => {
  test('no steppers render and nothing is written', () => {
    const pilot = makePilot()
    const updateSpy = mock(async () => pilot)
    renderHero(pilot, updateSpy, true)

    expect(screen.queryByRole('button', { name: /increase/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /decrease/i })).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
