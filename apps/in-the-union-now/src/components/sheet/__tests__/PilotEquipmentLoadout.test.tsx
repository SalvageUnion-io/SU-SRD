/**
 * PilotEquipmentLoadout — drone/companion installed-loadout section tests.
 *
 * Asserts that:
 *   1. Systems + Modules sections render the seeded installed items (resolved
 *      to their reference names) and the used/max slot counts.
 *   2. Editable mode exposes the "Add system"/"Add module" affordances and
 *      opening one shows the picker; readOnly hides them.
 *   3. isLoadoutHost gates on the slot-carrying data shape.
 *
 * Store-injection seam; NO mock.module().
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { PilotEquipmentLoadout, isLoadoutHost } from '../PilotEquipmentLoadout'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { useEntityStore } from '../../../stores/entityStore'

// Installed system/module cards resolve via reference + nest trait/keyword
// lookups, so preload 'all'.
beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

const PILOT_ID = 'pilot-loadout-cmp'
// A drone-equipment-shaped record: only name + slot fields are read.
const SURVEY_DRONE = { name: 'Survey Drone', systemSlots: 3, moduleSlots: 1 }
const SEED = { systems: ['red-laser'], modules: ['comms-module'] }

function makeStore(): typeof useEntityStore {
  const current = { id: PILOT_ID } as unknown as Pilot
  const storeState = {
    pilots: [current],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    get: mock(() => current),
    create: mock(async () => current),
    update: mock(async () => current),
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

describe('isLoadoutHost', () => {
  test('true for slot-carrying equipment, false otherwise', () => {
    expect(isLoadoutHost({ systemSlots: 3 })).toBe(true)
    expect(isLoadoutHost({ moduleSlots: 1 })).toBe(true)
    expect(isLoadoutHost({ name: 'First Aid Kit' })).toBe(false)
    expect(isLoadoutHost(null)).toBe(false)
  })
})

describe('PilotEquipmentLoadout — render', () => {
  test('renders installed systems/modules + slot counts, and the add affordances', () => {
    render(
      <PilotEquipmentLoadout
        pilotId={PILOT_ID}
        slug="survey-drone"
        equipment={SURVEY_DRONE}
        seed={SEED}
        readOnly={false}
        store={makeStore()}
      />
    )
    // Section headings.
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('Modules')).toBeTruthy()
    // Installed items resolved to names.
    expect(screen.getByText('Red Laser')).toBeTruthy()
    expect(screen.getByText('Comms Module')).toBeTruthy()
    // Used/max slot counts.
    expect(screen.getByText('1/3 slots')).toBeTruthy()
    expect(screen.getByText('1/1 slots')).toBeTruthy()
    // Editable add affordances.
    expect(screen.getByLabelText('Add system')).toBeTruthy()
    expect(screen.getByLabelText('Add module')).toBeTruthy()
  })

  test('empty loadout shows the empty copy', () => {
    render(
      <PilotEquipmentLoadout
        pilotId={PILOT_ID}
        slug="survey-drone"
        equipment={SURVEY_DRONE}
        seed={undefined}
        readOnly={false}
        store={makeStore()}
      />
    )
    expect(screen.getByText('No systems installed.')).toBeTruthy()
    expect(screen.getByText('No modules installed.')).toBeTruthy()
    expect(screen.getByText('0/3 slots')).toBeTruthy()
  })

  test('readOnly hides the add affordances', () => {
    render(
      <PilotEquipmentLoadout
        pilotId={PILOT_ID}
        slug="survey-drone"
        equipment={SURVEY_DRONE}
        seed={SEED}
        readOnly={true}
        store={makeStore()}
      />
    )
    expect(screen.queryByLabelText('Add system')).toBeNull()
    expect(screen.queryByLabelText('Add module')).toBeNull()
  })
})
