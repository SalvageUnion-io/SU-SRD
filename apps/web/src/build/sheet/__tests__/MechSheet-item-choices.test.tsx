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
import { LIVE_SHEET_MANUAL } from '../../../replica/provenance'
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
})
