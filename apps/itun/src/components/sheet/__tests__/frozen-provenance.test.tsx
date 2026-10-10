/**
 * Frozen-surface guard (P5 / ADR-022, ADR-010): a read-only sheet renders an
 * overridden cap as a plain value, because a frozen view has no revert.
 *
 * It locks an invariant that already holds by construction — the override
 * affordances are gated on !readOnly — so a future change can't quietly leak a
 * revert control or the owner-only Change Log into a read-only surface (the
 * public sheet, a crewmate's sheet in a Game).
 *
 * (Its P5.1 sibling asserted that a published snapshot payload carried no
 * history. Snapshots are retired — ADR-036 — so there is no payload left to
 * check.)
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import { _resetDbSingleton, clearCache } from '../../../lib/db/index'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { Sheet } from '../Sheet'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

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
    hydrated: { pilots: false, mechs: false, crawlers: false, npcs: false, softLinks: false },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
  resetEntityStore()
})

describe('Frozen surface — overrides render as plain values (P5.2)', () => {
  test('a read-only sheet shows the capped max with no override/revert affordance', async () => {
    const pilot = await useEntityStore
      .getState()
      .create('pilot', { ...basePilotInput, maxHpModifier: 2 })

    render(<Sheet kind="pilot" id={pilot.id} readOnly />)

    // The gauge renders as a non-interactive read-out (role="img").
    await waitFor(() => expect(screen.getByRole('img', { name: /HP \d+ of \d+/ })).toBeTruthy())
    // No "overridden from" note, no edit-max button, no revert — frozen is plain.
    expect(screen.queryByText(/overridden from/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /override hp max/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /revert hp max/i })).toBeNull()
    // And the Change Log menu is owner-only — absent on the frozen surface.
    expect(screen.queryByRole('button', { name: /change log/i })).toBeNull()
  })
})
