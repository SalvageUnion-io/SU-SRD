/**
 * Unit tests for MechChassisPickerModal's wiring onto the shared EntitySearcher.
 *
 * Focus: the identity contract, which is the part the migration off the bespoke
 * master/detail panes could silently get wrong. The mech record stores a chassis
 * SLUG, so the picker must emit `nameToSlug(name)` and not the searcher's default
 * (the entity name) — a mismatch here would write an unresolvable `chassisRef`
 * while every surface still rendered as if the swap had worked.
 *
 * Also pins the destructive-flow gate: nothing is written until a DIFFERENT chassis
 * is chosen, and `onConfirm` fires only after the danger dialog is confirmed.
 *
 * Renders against real SalvageUnionReference data (preloaded via bunfig.toml);
 * the searcher reads the ORM directly, so no DB scaffolding is needed.
 */

import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { openInSearcher } from '../../../components/__tests__/searcherPick'
import { MechChassisPickerModal } from '../MechChassisPickerModal'

/** Two distinct real chassis — the current one and the one we swap to. */
function twoChassis(): [{ name: string }, { name: string }] {
  const all = SalvageUnionReference.Chassis.all()
  const [first, second] = all
  if (!first || !second) throw new Error('Need two chassis in reference data')
  return [first, second]
}

function renderPicker(
  onConfirm: (ref: string, keep?: boolean) => void = () => {},
  loadout: { systems: string[]; modules: string[] } = { systems: [], modules: [] },
  onOpenChange: (open: boolean) => void = () => {}
) {
  const [current, other] = twoChassis()
  render(
    <MechChassisPickerModal
      open
      currentChassisRef={nameToSlug(current.name)}
      loadout={loadout}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  )
  return { current, other }
}

/**
 * Each test renders the full shared searcher over the real chassis pool (51
 * cards), so the tests are as few as the contracts allow: three renders, each
 * one pinning what a shorter sequence would only repeat. About 3 s a test under
 * `--coverage` alone, and 2.5 s to 5.1 s in CI's coverage shard: past Bun's 5 s
 * default, so each test sets its own.
 */
const RENDER_TIMEOUT_MS = 10_000

describe('MechChassisPickerModal', () => {
  it(
    'renders the shared searcher with the mech’s current chassis in the rail',
    async () => {
      const { current } = renderPicker()
      // The searcher's own affordances, not a bespoke master/detail pane: a text
      // search and the pool summary.
      expect(screen.getByLabelText('Search')).toBeDefined()
      expect(screen.getByText(/showing \d+ of \d+/i)).toBeDefined()
      // The current chassis is pre-selected.
      expect(screen.getByTestId('rail-entry').textContent).toContain(current.name)
      // An opened chassis's Page shows its chassis ability (E19's builder
      // exception): once.
      await openInSearcher(current.name)
      expect((document.body.textContent ?? '').split('Integrated Cargo Bay').length - 1).toBe(1)
    },
    RENDER_TIMEOUT_MS
  )

  it(
    'offers no way to clear the chassis, and no Apply step',
    async () => {
      const seen: string[] = []
      const { current } = renderPicker((ref) => seen.push(ref))

      // A mech must always have a chassis: the chosen one's Page offers no
      // Choose and the rail no Remove, so nothing can write `chassisRef: ''`.
      const bar = await openInSearcher(current.name)
      expect(within(bar).queryByRole('button')).toBeNull()
      expect(screen.queryByRole('button', { name: `Remove ${current.name}` })).toBeNull()
      expect(screen.getAllByTestId('rail-entry')).toHaveLength(1)
      // A picker that holds one thing applies on Choose (r2 G3): no Apply.
      expect(screen.queryByRole('button', { name: /apply/i })).toBeNull()
      expect(seen).toEqual([])
    },
    RENDER_TIMEOUT_MS
  )

  it(
    'Choose applies a different chassis, by SLUG, in one press, and says first what will not fit',
    async () => {
      const seen: string[] = []
      const closed: boolean[] = []
      // More one-slot systems than any chassis holds: some will not fit.
      const small = SalvageUnionReference.Systems.all().find((s) => s.slotsRequired === 1)
      if (!small) throw new Error('no one-slot system')
      const { other } = renderPicker(
        (ref) => seen.push(ref),
        { systems: new Array<string>(60).fill(nameToSlug(small.name)), modules: [] },
        (open) => closed.push(open)
      )

      expect(screen.getByText('Your loadout stays where it fits the new chassis.')).toBeDefined()
      // Reading a chassis writes nothing, and says beside its Choose what comes off.
      const bar = await openInSearcher(other.name)
      expect(seen).toEqual([])
      expect(
        within(bar).getByText(new RegExp(`Will not fit, and comes off: ${small.name} ×\\d+`))
      ).toBeDefined()

      // Choose is the one confirming press: no Apply, no second dialog (the sheet offers Undo).
      fireEvent.click(within(bar).getByRole('button', { name: 'Choose' }))
      expect(seen).toEqual([nameToSlug(other.name)])
      expect(closed).toEqual([false])
    },
    RENDER_TIMEOUT_MS
  )

  it(
    'beside what will not fit, offers to keep everything over the slots (r5 C10)',
    async () => {
      const seen: [string, boolean | undefined][] = []
      const small = SalvageUnionReference.Systems.all().find((s) => s.slotsRequired === 1)
      if (!small) throw new Error('no one-slot system')
      const { other } = renderPicker((ref, keep) => seen.push([ref, keep]), {
        systems: new Array<string>(60).fill(nameToSlug(small.name)),
        modules: [],
      })
      await openInSearcher(other.name)
      fireEvent.click(screen.getByRole('button', { name: 'Keep everything (rule breaking)' }))
      expect(seen).toEqual([[nameToSlug(other.name), true]])
    },
    RENDER_TIMEOUT_MS
  )
})
