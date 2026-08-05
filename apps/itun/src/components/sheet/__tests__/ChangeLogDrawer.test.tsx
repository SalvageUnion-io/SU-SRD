/**
 * ChangeLogDrawer tests (ADR-022) — the per-entity Change Log shown behind the
 * sheet's overflow menu. Exercises the real db.changeLog read path against
 * fake-indexeddb (preloaded via bunfig.toml), plus the menu → drawer wiring on
 * the Sheet.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } from '../../../stores/surfaceProvenance'
import { ChangeLogDrawer } from '../ChangeLogDrawer'
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

describe('ChangeLogDrawer', () => {
  test('renders entries with field, before→after, and kind badge', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', basePilotInput)
    await act(async () => {
      await store.update('pilot', pilot.id, { callsign: 'Wraith' }, LIVE_SHEET_OVERRIDE)
      await store.update('pilot', pilot.id, { motto: 'Rise again.' }, LIVE_SHEET_MANUAL)
    })

    render(
      <ChangeLogDrawer
        entityType="pilot"
        entityId={pilot.id}
        entityName="Yara Voss"
        open
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText('callsign')).toBeTruthy())
    expect(screen.getByText('motto')).toBeTruthy()
    expect(screen.getByText('Wraith')).toBeTruthy()
    // The cap edit carried kind:'override' → an Override badge renders.
    expect(screen.getByText('Override')).toBeTruthy()
    // The plain Free-Edit write is tagged manual → a Manual badge.
    expect(screen.getByText('Manual')).toBeTruthy()
  })

  test('shows an empty state when the entity has no logged changes', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', basePilotInput)

    render(
      <ChangeLogDrawer
        entityType="pilot"
        entityId={pilot.id}
        entityName="Yara Voss"
        open
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/No changes recorded yet/i)).toBeTruthy())
  })

  test('renders nothing while closed', () => {
    render(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="none"
        entityName="Yara Voss"
        open={false}
        onOpenChange={() => {}}
      />
    )
    expect(screen.queryByText('Change Log')).toBeNull()
  })
})

describe('Sheet — Change Log menu wiring', () => {
  test('the overflow menu opens the Change Log drawer', async () => {
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', basePilotInput)

    render(<Sheet kind="pilot" id={pilot.id} />)

    // Open the "⋯" overflow menu, then click the Change Log item.
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('button', { name: /change log for this pilot/i }))

    // The drawer (ModalShell dialog) mounts with the "Change Log" title.
    await waitFor(() => expect(screen.getByText(/No changes recorded yet/i)).toBeTruthy())
  })
})
