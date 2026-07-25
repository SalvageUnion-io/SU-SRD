/**
 * P4.4 — the Dashboard is reachable from a pilot/mech Live Sheet, not just the
 * Roster. An editable sheet mounts a pre-seeded "Launch Dashboard" chooser; the
 * frozen (read-only) sheet does not.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { Sheet } from '../Sheet'

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Everything burns.',
  keepsake: 'A compass.',
  appearance: 'Tall.',
  background: '',
  conditions: [],
}

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(() => {
  cleanup()
})

// The sticky top bar is `aria-hidden` at rest — it only slides in once the
// first row scrolls away, and happy-dom never fires the observer that flips
// that. `{ hidden: true }` looks inside it, which is what these assertions are
// about: the bar OFFERS this control, not that it is on screen right now.
describe('Live Sheet — Launch Dashboard entry (P4.4)', () => {
  test('an editable pilot sheet offers a Launch Dashboard button', async () => {
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)
    render(<Sheet kind="pilot" id={pilot.id} />)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /launch the dashboard/i, hidden: true })
      ).toBeTruthy()
    )
  })

  test('the frozen (read-only) sheet has no Launch Dashboard button', async () => {
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)
    render(<Sheet kind="pilot" id={pilot.id} readOnly />)
    // Give the sheet a tick to render, then assert the launch entry is absent.
    await waitFor(() => expect(screen.getByRole('img', { name: /HP \d+ of \d+/ })).toBeTruthy())
    expect(screen.queryByRole('button', { name: /launch the dashboard/i })).toBeNull()
  })
})
