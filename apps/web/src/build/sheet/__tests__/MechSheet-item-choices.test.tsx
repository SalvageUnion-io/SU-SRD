/**
 * MechSheet — an installed System's chosen options (`Mech.itemChoices`).
 *
 * A System or Module that asks a choice (an Automated Weapon Turret's weapon)
 * offers Details in Edit; the option chosen on its Page is saved on the mech by
 * the item's slug, beside the options of every other item, where Play reads
 * them. An item that asks nothing offers no Details.
 *
 * Conventions: no mock.module(), dep-injected store.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { resolveSystem } from '../../../lib/rules/mechItems'
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
import { choicesOf } from '../../wizard/pickColumns'
import { MechSheet } from '../MechSheet'

const TURRET = 'automated-weapon-turret'
const TURRET_NAME = 'Automated Weapon Turret'
const PLAIN = '50-cal-machine-gun'

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 14,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 12,
  moduleSlots: 2,
  cargoCapacity: 4,
}

function makeMech(overrides: Partial<Mech>): Mech {
  return {
    id: 'mech-choices-1',
    schemaVersion: 1,
    name: 'Choice Test Mech',
    chassisRef: 'iron-mongrel',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  }
}

function renderSheet(mech: Mech) {
  let current = mech
  const update = mock(async (_type: string, _id: string, patch: Partial<Mech>, _meta: unknown) => {
    current = { ...current, ...patch }
    return current
  })
  const store = makeSingleUnitStore('mech', () => current, { update })
  render(<MechSheet mech={mech} chassis={fakeChassis} store={store} />)
  return update
}

describe('MechSheet — an item’s chosen options', () => {
  test('an option chosen on its Details page is saved as mech.itemChoices, by the item’s slug', async () => {
    const kept = { 'some-other-item': { 'choice-x': ['Kept'] } }
    const update = renderSheet(makeMech({ systems: [TURRET], itemChoices: kept }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `${TURRET_NAME} details` }))
    })
    const page = screen.getByRole('dialog')
    const option = must(within(page).getAllByRole('button', { pressed: false })[0])
    await act(async () => {
      fireEvent.click(option)
    })

    expect(update).toHaveBeenCalledTimes(1)
    const [type, id, patch, meta] = must(update.mock.calls[0])
    expect([type, id, meta]).toEqual(['mech', 'mech-choices-1', LIVE_SHEET_MANUAL])
    const saved = must(patch.itemChoices)
    // Every other item's options stand.
    expect(saved['some-other-item']).toEqual(kept['some-other-item'])
    const picks = Object.values(must(saved[TURRET]))
    expect(picks).toHaveLength(1)
    expect(picks[0]).toHaveLength(1)
  })

  test('an item that asks no choice offers no Details', () => {
    renderSheet(makeMech({ systems: [PLAIN] }))
    expect(screen.queryByRole('button', { name: /details$/i })).toBeNull()
  })

  test('removing the last copy of an item drops its choices; removing one of two keeps them', async () => {
    const choices = { [TURRET]: { weapon: ['Kept'] }, other: { x: ['y'] } }
    const update = renderSheet(makeMech({ systems: [TURRET, TURRET], itemChoices: choices }))
    await act(async () => {
      fireEvent.click(must(screen.getAllByRole('button', { name: `Remove ${TURRET_NAME}` })[0]))
    })
    const first = must(must(update.mock.calls[0])[2])
    expect(first.systems).toEqual([TURRET])
    expect(first.itemChoices).toBeUndefined()
    await act(async () => {
      fireEvent.click(must(screen.getAllByRole('button', { name: `Remove ${TURRET_NAME}` })[0]))
    })
    const last = must(must(update.mock.calls[1])[2])
    expect(last.systems).toEqual([])
    expect(last.itemChoices).toEqual({ other: { x: ['y'] } })
  })

  test('a System that asks a choice asks it as it is added (PT-31)', async () => {
    const update = renderSheet(makeMech({ systems: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Manage Systems' }))
    const search = screen.getByRole('textbox', { name: 'Search' })
    fireEvent.change(search, { target: { value: TURRET_NAME } })
    await act(async () => {
      fireEvent.keyDown(search, { key: 'Enter' })
    })
    expect(must(must(update.mock.calls[0])[2]).systems).toEqual([TURRET])
    const page = screen.getByRole('dialog')
    expect(within(page).queryByRole('textbox', { name: 'Search' })).toBeNull()
    expect(within(page).getAllByRole('button', { pressed: false }).length).toBeGreaterThan(0)
  })

  test('Read marks a choice not yet made; a made one and a plain item wear no mark (PT-31)', () => {
    const read = (mech: Mech) => {
      const view = render(
        <MechSheet
          mech={mech}
          chassis={fakeChassis}
          store={makeSingleUnitStore('mech', mech)}
          readOnly
        />
      )
      const text = view.container.textContent ?? ''
      view.unmount()
      return text
    }
    expect(read(makeMech({ systems: [TURRET] }))).toContain('Choice not made')
    expect(read(makeMech({ systems: [PLAIN] }))).not.toContain('Choice not made')
    const turret = must(resolveSystem(TURRET))
    const picks = Object.fromEntries(choicesOf(turret).map((choice) => [choice.id, ['Picked']]))
    expect(read(makeMech({ systems: [TURRET], itemChoices: { [TURRET]: picks } }))).not.toContain(
      'Choice not made'
    )
  })
})
