/**
 * Live Sheet soft warnings (ADR-021) — the wired-in behaviour of
 * `useSoftWarnings` + `SoftWarningDialog`.
 *
 * Asserts the confirm-and-proceed contract on BUILD edits:
 *   1. A warning-triggering ability removal opens the dialog and persists
 *      NOTHING until confirmed; Cancel then persists nothing.
 *   2. "Save anyway" persists the previewed patch (warnings never block).
 *   3. A clean edit persists immediately with no dialog — the flow is
 *      invisible when nothing is wrong.
 *   4. Mech system removal previews (no dependency data in the SRD dataset →
 *      no warnings → it saves straight through).
 *
 * Real reference data only: the Engineer class's "Mechanical Knowledge" core
 * tree runs Engineering Expertise (L1) → Talk Shop (L2) → Mech Acquisition
 * (L3), so dropping L1 while L2 is held trips ABILITY_TREE_ORDER.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { MechSheet } from '../MechSheet'
import { PilotSheet } from '../PilotSheet'

const ABILITY_L1 = 'Engineering Expertise'
const ABILITY_L2 = 'Talk Shop'
const ABILITY_L1_SLUG = 'engineering-expertise'
const ABILITY_L2_SLUG = 'talk-shop'

type CapturedUpdate = { type: string; id: string; patch: Record<string, unknown> }

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-sw-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'Engineer',
    abilities: [ABILITY_L1_SLUG, ABILITY_L2_SLUG],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    currentHP: 10,
    currentAP: 5,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  }
}

/** A one-unit store whose writes are captured and land on the unit. */
function makeCaptureStore(kind: 'pilot' | 'mech', unit: Pilot | Mech, captured: CapturedUpdate[]) {
  let current = unit
  return makeSingleUnitStore(kind, () => current, {
    update: async (type, id, patch) => {
      captured.push({ type, id, patch })
      current = { ...current, ...patch } as Pilot | Mech
      return current
    },
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
    systems: ['smoke-machine'],
    modules: [],
    cargoLots: [],
    conditions: [],
    currentEP: 5,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  } as Mech
}

async function click(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

/**
 * Remove a collection item the way a player now does: the per-card ✕ is gone,
 * so management happens in the section's picker. Open it from the slab's
 * "Manage …" button, then press the item's ✕ in the searcher's chosen rail.
 */
async function removeViaPicker(manage: RegExp, item: string) {
  await click(manage)
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: new RegExp(`^Remove ${item}$`, 'i'),
      })
    )
  })
}

/**
 * Each test renders a live sheet and drives its picker, so the dialog's opening
 * and its Cancel share one render rather than two. Up to 1.1 s a test inside
 * the app's 4-worker suite, and under 2.7 s with the reference site, src/components and tools
 * running beside it (junit), well under Bun's 5 s default, so they keep it.
 */
describe('PilotSheet — soft warnings on ability edits', () => {
  test('a tree-order-breaking removal opens the dialog; cancel persists nothing', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    await removeViaPicker(/^Manage abilities$/i, ABILITY_L1)

    // The advisory dialog names the offending rule…
    expect(screen.getByText(/trees are taken in order/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /save anyway/i })).toBeTruthy()
    // …and nothing has been written yet.
    expect(captured).toHaveLength(0)

    await click(/^cancel$/i)

    expect(captured).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
  })

  test('"Save anyway" persists the previewed patch — warnings never block', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    await removeViaPicker(/^Manage abilities$/i, ABILITY_L1)
    await click(/save anyway/i)

    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toEqual({ abilities: [ABILITY_L2_SLUG] })
  })

  test('a clean removal persists immediately with no dialog', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    // Dropping the L2 leaves a well-ordered tree — nothing to warn about.
    await removeViaPicker(/^Manage abilities$/i, ABILITY_L2)

    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toEqual({ abilities: [ABILITY_L1_SLUG] })
  })
})

describe('PilotSheet — advancing warns before it breaks a rule (r2 E4)', () => {
  /** Open Manage Abilities and read an ability's Page: its action bar. */
  async function focusAbility(name: string) {
    await click(/^Manage abilities$/i)
    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name }))
    })
    return within(within(dialog).getByRole('group', { name: `${name} actions` }))
  }

  test('too few TP: the free Add is not the bold button, and asks before it adds', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot({ abilities: [ABILITY_L1_SLUG], trainingPoints: 0 })
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    const bar = await focusAbility(ABILITY_L2)
    const free = bar.getByRole('button', { name: 'Add to Yara Voss' })
    expect(free.className).not.toContain('primary')
    expect(bar.getByRole('button', { name: 'Spend 1 TP and add' })).toHaveProperty('disabled', true)
    // In order in its tree: nothing the book asks first.
    expect(bar.queryByRole('list', { name: 'The book asks first' })).toBeNull()

    await act(async () => {
      fireEvent.click(free)
    })
    expect(screen.getByText('Add Talk Shop without spending?')).toBeTruthy()
    expect(screen.getByText(/costs 1 TP to train and this Pilot has 0/)).toBeTruthy()
    expect(captured).toHaveLength(0)

    await click(/save anyway/i)
    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toMatchObject({ abilities: [ABILITY_L1_SLUG, ABILITY_L2_SLUG] })
    expect(captured[0]?.patch).not.toHaveProperty('trainingPoints')
  })

  test('enough TP: the free Add stays, unasked, beside the bold Spend', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot({ abilities: [ABILITY_L1_SLUG], trainingPoints: 1 })
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    const bar = await focusAbility(ABILITY_L2)
    expect(bar.getByRole('button', { name: 'Spend 1 TP and add' }).className).toContain('primary')
    const free = bar.getByRole('button', { name: 'Add to Yara Voss' })
    expect(free.className).not.toContain('primary')
    await act(async () => {
      fireEvent.click(free)
    })
    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
    expect(captured).toHaveLength(1)
  })

  test('an unmet tree requirement is said on the bar, and still added after one confirm', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot({ abilities: [], trainingPoints: 3 })
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    const bar = await focusAbility('Mech Acquisition')
    expect(
      within(bar.getByRole('list', { name: 'The book asks first' })).getByText(
        /level 1 and 2 of that tree haven't been taken/
      )
    ).toBeTruthy()

    await act(async () => {
      fireEvent.click(bar.getByRole('button', { name: 'Spend 1 TP and add' }))
    })
    expect(captured).toHaveLength(0)
    await click(/save anyway/i)
    expect(captured[0]?.patch).toMatchObject({
      abilities: ['mech-acquisition'],
      trainingPoints: 2,
    })
  })
})

describe('MechSheet — soft warnings on system removal', () => {
  test('removing a system persists immediately (no dependency data to flag)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech()
    render(
      <MechSheet
        mech={mech}
        chassis={fakeChassis}
        store={makeCaptureStore('mech', mech, captured)}
      />
    )

    await click(/^Manage systems$/i)
    // Removing is the rail's ✕.
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('region', { name: /^Installed/i })).getByRole('button', {
          name: /^Remove Smoke Machine$/i,
        })
      )
    })

    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toEqual({ systems: [] })
  })
})
