/**
 * The Dashboard is Game-only (ADR-038 §1) and opens from the Game roster's
 * Play button, so a live sheet launches nothing. An editable shelf sheet says
 * where play happens instead; a Game sheet and the read-only sheet say nothing.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(() => {
  cleanup()
})

describe('Live Sheet — Play in a Game hint', () => {
  test('an editable shelf pilot sheet says to play in a Game', async () => {
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)
    render(<Sheet kind="pilot" id={pilot.id} />)
    await waitFor(() => expect(screen.getByText('Play in a Game')).toBeTruthy())
    // The retired launch chooser is gone with it.
    expect(screen.queryByRole('button', { name: /launch the dashboard/i })).toBeNull()
  })

  test('the frozen (read-only) sheet has no hint', async () => {
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)
    render(<Sheet kind="pilot" id={pilot.id} readOnly />)
    // Give the sheet a tick to render, then assert the hint is absent.
    await waitFor(() => expect(screen.getByRole('img', { name: /HP \d+ of \d+/ })).toBeTruthy())
    expect(screen.queryByText('Play in a Game')).toBeNull()
  })

  test("a Game pilot's sheet has no hint: its roster has Play", async () => {
    const pilot = await useEntityStore
      .getState()
      .create('pilot', { ...basePilotInput, gameId: 'game-a' })
    render(<Sheet kind="pilot" id={pilot.id} />)
    await waitFor(() => expect(screen.getAllByText('Yara Voss').length).toBeGreaterThan(0))
    expect(screen.queryByText('Play in a Game')).toBeNull()
  })
})
