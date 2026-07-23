/**
 * Frozen-surface guards (P5 / ADR-022, ADR-010): a published snapshot is a
 * bare, historyless entity, and the read-only viewer renders an overridden cap
 * as a plain value (a frozen view has no revert).
 *
 * These lock invariants that already hold by construction — the Change Log is a
 * separate IndexedDB store (never part of the {kind, entity} payload), and the
 * override affordances are gated on !readOnly — so a future change can't quietly
 * leak history or a revert control into the frozen surface.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import type { PublishResult, SnapshotPayload } from '../../../lib/snapshot/client'
import type { EntityLookup } from '../composition'
import type { Mech } from '../../../lib/schemas/mech'
import { useEntityStore } from '../../../stores/entityStore'
import { Sheet } from '../Sheet'
import { ShareSnapshotScreen } from '../ShareSnapshotScreen'
import { makeEntityLookupMock } from '../../__tests__/mockEntityStore'
import { must } from '../../__tests__/must'

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

// A mech with a cap override baked in (maxSpModifier) — the frozen payload must
// still be a bare entity with no separate history attached.
const overriddenMech: Mech = {
  id: 'mech-frozen-1',
  schemaVersion: 1,
  name: 'Iron Jaw',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  maxSpModifier: 4,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeEntityStore(entities: Mech[]): EntityLookup {
  return makeEntityLookupMock(entities)
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
  localStorage.clear()
  cleanup()
})

describe('Frozen surface — Change Log stays out of the snapshot (P5.1)', () => {
  test('a published payload is exactly {kind, entity} with no history/provenance', async () => {
    const publishFn = mock(
      async (_payload: SnapshotPayload): Promise<PublishResult> => ({
        id: 'a',
        url: '/api/snapshots/a',
      })
    )

    render(
      <ShareSnapshotScreen
        kind="mech"
        id={overriddenMech.id}
        entityStore={makeEntityStore([overriddenMech])}
        probeFn={() => Promise.resolve(true)}
        publishFn={publishFn}
      />
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /publish snapshot/i })).toBeTruthy()
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /publish snapshot/i }))
    })

    await waitFor(() => expect(publishFn).toHaveBeenCalled())
    const payload: SnapshotPayload = must(publishFn.mock.calls[0], 'captured publish call')[0]
    expect(Object.keys(payload).sort()).toEqual(['entity', 'kind'])
    const entity = payload.entity as Record<string, unknown>
    // The append-only log lives in its own store — it must not ride along.
    expect(entity.changeLog).toBeUndefined()
    expect(entity.history).toBeUndefined()
    expect(entity.provenance).toBeUndefined()
  })
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
