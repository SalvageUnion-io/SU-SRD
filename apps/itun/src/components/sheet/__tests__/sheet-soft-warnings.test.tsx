/**
 * Live Sheet soft warnings (REQ-012, ADR-021) — the wired-in behaviour of
 * `useSoftWarnings` + `SoftWarningDialog`.
 *
 * Asserts the confirm-and-proceed contract on BUILD edits:
 *   1. A warning-triggering ability removal opens the dialog and persists
 *      NOTHING until confirmed.
 *   2. "Save anyway" persists the previewed patch (warnings never block).
 *   3. Cancel persists nothing.
 *   4. A clean edit persists immediately with no dialog — the flow is
 *      invisible when nothing is wrong.
 *   5. Mech system removal previews (no dependency data in the SRD dataset →
 *      no warnings → it saves straight through).
 *
 * Real reference data only: the Engineer class's "Mechanical Knowledge" core
 * tree runs Engineering Expertise (L1) → Talk Shop (L2) → Mech Acquisition
 * (L3), so dropping L1 while L2 is held trips ABILITY_TREE_ORDER.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import { PilotSheet } from '../PilotSheet'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const ABILITY_L1 = 'Engineering Expertise'
const ABILITY_L2 = 'Talk Shop'

type CapturedUpdate = { type: string; id: string; patch: Record<string, unknown> }

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-sw-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'Engineer',
    abilities: [ABILITY_L1, ABILITY_L2],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    currentHP: 10,
    currentAP: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makePilotStore(pilot: Pilot, captured: CapturedUpdate[]): typeof useEntityStore {
  let current = pilot
  return makeEntityStoreMock({
    pilots: [pilot],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock((type: string, id: string) =>
      type === 'pilot' && id === current.id ? current : null
    ),
    create: mock(async () => current),
    update: mock(async (type: string, id: string, patch: Record<string, unknown>) => {
      captured.push({ type, id, patch })
      current = { ...current, ...patch } as Pilot
      return current
    }),
    delete: mock(async () => {}),
  })
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

function makeMech(overrides: Partial<Mech> = {}): Mech {
  return {
    id: 'mech-sw-1',
    schemaVersion: 1,
    name: 'Warning Test Mech',
    chassisRef: 'iron-mongrel',
    systems: ['Smoke Machine'],
    modules: [],
    cargoLots: [],
    conditions: [],
    currentEP: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Mech
}

function makeMechStore(mech: Mech, captured: CapturedUpdate[]): typeof useEntityStore {
  let current = mech
  return makeEntityStoreMock({
    mechs: [mech],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock((type: string, id: string) =>
      type === 'mech' && id === current.id ? current : null
    ),
    create: mock(async () => current),
    update: mock(async (type: string, id: string, patch: Record<string, unknown>) => {
      captured.push({ type, id, patch })
      current = { ...current, ...patch } as Mech
      return current
    }),
    delete: mock(async () => {}),
  })
}

async function click(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('PilotSheet — soft warnings on ability edits', () => {
  test('a tree-order-breaking removal opens the dialog and persists nothing', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makePilotStore(pilot, captured)} />)

    await click(new RegExp(`^Remove ${ABILITY_L1}$`, 'i'))

    // The advisory dialog names the offending rule…
    expect(screen.getByText(/trees are taken in order/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /save anyway/i })).toBeTruthy()
    // …and nothing has been written yet.
    expect(captured).toHaveLength(0)
  })

  test('"Save anyway" persists the previewed patch — warnings never block', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makePilotStore(pilot, captured)} />)

    await click(new RegExp(`^Remove ${ABILITY_L1}$`, 'i'))
    await click(/save anyway/i)

    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toEqual({ abilities: [ABILITY_L2] })
  })

  test('cancelling discards the edit — nothing is persisted', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makePilotStore(pilot, captured)} />)

    await click(new RegExp(`^Remove ${ABILITY_L1}$`, 'i'))
    await click(/^cancel$/i)

    expect(captured).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
  })

  test('a clean removal persists immediately with no dialog', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makePilotStore(pilot, captured)} />)

    // Dropping the L2 leaves a well-ordered tree — nothing to warn about.
    await click(new RegExp(`^Remove ${ABILITY_L2}$`, 'i'))

    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toEqual({ abilities: [ABILITY_L1] })
  })
})

describe('MechSheet — soft warnings on system removal', () => {
  test('removing a system persists immediately (no dependency data to flag)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech()
    render(<MechSheet mech={mech} chassis={fakeChassis} store={makeMechStore(mech, captured)} />)

    await click(/^Remove Smoke Machine$/i)

    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toEqual({ systems: [] })
  })
})
