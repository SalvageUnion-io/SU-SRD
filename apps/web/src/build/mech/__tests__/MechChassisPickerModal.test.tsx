/**
 * Unit tests for MechChassisPickerModal's wiring onto the shared EntitySearcher.
 *
 * Focus: the identity contract, which is the part the migration off the bespoke
 * master/detail panes could silently get wrong. The mech record stores a chassis
 * SLUG, so the picker must emit `nameToSlug(name)` and not the searcher's default
 * (the entity name) — a mismatch here would write an unresolvable `chassisRef`
 * while every surface still rendered as if the swap had worked.
 *
 * Also pins the destructive-flow gate: Apply is inert until a DIFFERENT chassis
 * is chosen, and `onConfirm` fires only after the danger dialog is confirmed.
 *
 * Renders against real SalvageUnionReference data (preloaded via bunfig.toml);
 * the searcher reads the ORM directly, so no DB scaffolding is needed.
 */

import { describe, expect, it } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { openInSearcher, pickInSearcher } from '../../../components/__tests__/searcherPick'
import { MechChassisPickerModal } from '../MechChassisPickerModal'

/** Two distinct real chassis — the current one and the one we swap to. */
function twoChassis(): [{ name: string }, { name: string }] {
  const all = SalvageUnionReference.Chassis.all()
  const [first, second] = all
  if (!first || !second) throw new Error('Need two chassis in reference data')
  return [first, second]
}

function renderPicker(onConfirm: (ref: string) => void = () => {}) {
  const [current, other] = twoChassis()
  render(
    <MechChassisPickerModal
      open
      currentChassisRef={nameToSlug(current.name)}
      onOpenChange={() => {}}
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
    'offers no way to clear the chassis, so Apply never writes an EMPTY one',
    async () => {
      const seen: string[] = []
      const { current } = renderPicker((ref) => seen.push(ref))

      // A mech must always have a chassis: the chosen one's Page offers no
      // Choose and the rail no Remove — otherwise Apply could write
      // `chassisRef: ''` and wipe the loadout with it.
      const bar = await openInSearcher(current.name)
      expect(within(bar).queryByRole('button')).toBeNull()
      expect(screen.queryByRole('button', { name: `Remove ${current.name}` })).toBeNull()
      expect(screen.getAllByTestId('rail-entry')).toHaveLength(1)

      const apply = screen.getByRole('button', { name: /apply chassis/i })
      expect(apply.hasAttribute('disabled')).toBe(true)
      fireEvent.click(apply)
      expect(seen).toEqual([])
    },
    RENDER_TIMEOUT_MS
  )

  it(
    'applies only a different chassis, by SLUG, and only after the danger dialog',
    async () => {
      const seen: string[] = []
      const { other } = renderPicker((ref) => seen.push(ref))
      const apply = () => screen.getByRole('button', { name: /apply chassis/i })

      // Inert until a DIFFERENT chassis is chosen.
      expect(apply().hasAttribute('disabled')).toBe(true)
      await pickInSearcher(other.name)
      expect(apply().hasAttribute('disabled')).toBe(false)

      fireEvent.click(apply())
      // Apply opens the confirm; it must not have written anything yet.
      expect(seen).toEqual([])

      // ConfirmDialog settles its pending state after the action resolves.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^change chassis$/i }))
      })
      expect(seen).toEqual([nameToSlug(other.name)])
    },
    RENDER_TIMEOUT_MS
  )
})
