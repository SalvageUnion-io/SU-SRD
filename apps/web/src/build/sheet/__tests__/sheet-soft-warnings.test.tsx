/**
 * Live Sheet soft warnings (ADR-021) — a BUILD edit that breaks a rule.
 *
 * Pilot and mech treat it the same way (r3 B5): the edit saves at once, one
 * line says which rule it breaks, and Undo on that line takes it back. Nothing
 * asks first.
 *   1. A rule-breaking ability removal saves, says the rule, and Undo writes
 *      the abilities back.
 *   2. A clean edit saves with no rule-break line.
 *   3. Mech system removal previews (no dependency data in the SRD dataset →
 *      no warnings → it saves straight through).
 *
 * Real reference data only: the Engineer class's "Mechanical Knowledge" core
 * tree runs Engineering Expertise (L1) → Talk Shop (L2) → Mech Acquisition
 * (L3), so dropping L1 while L2 is held trips ABILITY_TREE_ORDER.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { toast } from '../../../components/index'
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

/** The unit's rule-break line, as the toaster holds it. */
type BreakLine = { title: string; action: { label: string; onClick: (e: unknown) => void } }

const breakLine = (unitId: string) =>
  toast
    .getToasts()
    .find((t) => t.id === `rule-break:${unitId}:build` && !('dismiss' in t && t.dismiss)) as
    | BreakLine
    | undefined

afterEach(() => {
  toast.dismiss()
})

describe('PilotSheet — a rule-breaking ability edit saves and says so (r3 B5)', () => {
  test('a tree-order-breaking removal saves at once, names the rule, and Undo puts it back', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    await removeViaPicker(/^Manage abilities$/i, ABILITY_L1)

    // Saved, with nothing asked first…
    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toMatchObject({ abilities: [ABILITY_L2_SLUG] })
    // …and one line names the offending rule and offers the way back.
    const line = breakLine(pilot.id)
    expect(line?.title).toMatch(/^Saved, rule breaking: .*trees are taken in order/i)
    expect(line?.action.label).toBe('Undo')

    await act(async () => {
      line?.action.onClick({})
    })
    expect(captured).toHaveLength(2)
    expect(captured[1]?.patch).toMatchObject({ abilities: [ABILITY_L1_SLUG, ABILITY_L2_SLUG] })
  })

  test('a clean removal saves with no rule-break line', async () => {
    const captured: CapturedUpdate[] = []
    const pilot = makePilot()
    render(<PilotSheet pilot={pilot} store={makeCaptureStore('pilot', pilot, captured)} />)

    // Dropping the L2 leaves a well-ordered tree — nothing to warn about.
    await removeViaPicker(/^Manage abilities$/i, ABILITY_L2)

    expect(breakLine(pilot.id)).toBeUndefined()
    expect(captured).toHaveLength(1)
    expect(captured[0]?.patch).toMatchObject({ abilities: [ABILITY_L1_SLUG] })
  })
})

describe('PilotSheet — advancing says what it breaks (r2 E4, r3 B5)', () => {
  /** Open Manage Abilities and read an ability's Page: its action bar. */
  async function focusAbility(name: string) {
    await click(/^Manage abilities$/i)
    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name }))
    })
    return within(within(dialog).getByRole('group', { name: `${name} actions` }))
  }

  test('too few TP: the free Add is not the bold button, and says so as it adds', async () => {
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
    expect(screen.queryByRole('button', { name: /save anyway/i })).toBeNull()
    expect(breakLine(pilot.id)?.title).toMatch(/costs 1 TP to train and this Pilot has 0/)
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
    expect(breakLine(pilot.id)).toBeUndefined()
    expect(captured).toHaveLength(1)
  })

  test('an unmet tree requirement is said on the bar, and still added, with Undo', async () => {
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
    expect(captured[0]?.patch).toMatchObject({
      abilities: ['mech-acquisition'],
      trainingPoints: 2,
    })
    // Undo gives the Training Point back with the ability.
    await act(async () => {
      breakLine(pilot.id)?.action.onClick({})
    })
    expect(captured[1]?.patch).toMatchObject({ abilities: [], trainingPoints: 3 })
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
