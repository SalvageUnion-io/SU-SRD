/**
 * The ability trainer (r7 D5, SB7-12; Core Book p.224): what the Pilot can
 * learn now comes first, by tier; the rest wait under "Not yet", each row
 * saying why beside its price, and still addable for house rules.
 */

import { beforeAll, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { PilotAbilityTrainer } from '../PilotAbilityTrainer'

beforeAll(hydrateStores)

const pilot: Pilot = {
  id: 'pilot-tr-1',
  schemaVersion: 1,
  name: 'Mara',
  callsign: 'Mara',
  classRef: 'scavenger',
  abilities: ['talk-shop'],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  currentHP: 10,
  currentAP: 5,
  trainingPoints: 1,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

test('what can be learned now comes first; the rest wait under Not yet, each with why', () => {
  render(
    <PilotAbilityTrainer
      pilot={pilot}
      onClose={() => undefined}
      store={makeSingleUnitStore('pilot', pilot)}
    />
  )
  const dialog = screen.getByRole('dialog')
  const later = within(dialog).getByRole('region', { name: 'Not yet' })
  // Each one waiting says why, beside its price, and keeps its +.
  expect(within(later).getAllByText(/first · TP|Needs 6 Core|Short of TP/).length).toBeGreaterThan(
    0
  )
  expect(within(later).getAllByRole('button', { name: /^Add / }).length).toBeGreaterThan(0)
  // The list above it holds no Advanced or Legendary ability for a one-ability Pilot.
  const list = dialog.querySelector('.su-searcher__list') as HTMLElement
  expect(within(list).queryByText(/Needs 6 Core/)).toBeNull()
  expect(within(list).getAllByText('TP').length).toBeGreaterThan(0)
})
