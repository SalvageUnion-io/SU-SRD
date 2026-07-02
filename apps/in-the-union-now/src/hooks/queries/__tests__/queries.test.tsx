/**
 * Tests for the hooks/queries layer (design review T-7).
 *
 * Covers the contract the migrated components rely on:
 *   - list/by-id hooks read the store's in-memory state
 *   - reading an unhydrated type auto-triggers lazy hydration (like
 *     entityStore.list())
 *   - by-id hooks return null for unknown/undefined ids
 *   - selector identity: an unrelated write does NOT re-render a by-id
 *     subscriber (entity references are stable across update() of others)
 *   - workspace hooks mirror the same contract; useWorkspaceActions is
 *     render-stable
 *
 * Conventions: real stores + fake-indexeddb, no mock.module(),
 * toBeTruthy()/toBeFalsy() (no jest-dom augmentation).
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'

import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import {
  useMech,
  usePilot,
  usePilots,
  useWorkspace,
  useWorkspaceActions,
  useWorkspaces,
} from '../index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Zara Heln',
  callsign: 'Flash',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Keep moving.',
  keepsake: 'Old photo.',
  appearance: 'Short.',
  background: '',
  conditions: [],
}

const baseMechInput = {
  schemaVersion: 1 as const,
  name: 'Iron Jaw',
  chassisRef: 'titan',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

function resetStores(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  useWorkspaceStore.setState({ workspaces: [], hydrated: false })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetStores()
})

afterEach(async () => {
  await _clearAllStores()
  resetStores()
})

// ---------------------------------------------------------------------------
// Entity hooks
// ---------------------------------------------------------------------------

describe('usePilots', () => {
  test('returns pilots from in-memory state', async () => {
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', basePilotInput)

    function PilotList() {
      const pilots = usePilots()
      return (
        <ul>
          {pilots.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )
    }

    await act(async () => {
      render(<PilotList />)
    })

    expect(screen.getByText('Zara Heln')).toBeTruthy()
  })

  test('auto-triggers lazy hydration for an unhydrated type', async () => {
    // Seed IndexedDB, then wipe in-memory state so pilots are unhydrated.
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', basePilotInput)
    resetStores()
    expect(useEntityStore.getState().hydrated.pilots).toBe(false)

    function PilotList() {
      const pilots = usePilots()
      return <p>{pilots[0]?.name ?? 'empty'}</p>
    }

    await act(async () => {
      render(<PilotList />)
    })

    // The hook fired hydrate(); once it resolves the subscriber re-renders.
    await waitFor(() => {
      expect(screen.getByText('Zara Heln')).toBeTruthy()
    })
    expect(useEntityStore.getState().hydrated.pilots).toBe(true)
  })
})

describe('usePilot / useMech (by id)', () => {
  test('returns the entity by id', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)

    function PilotName() {
      const p = usePilot(pilot.id)
      return <p>{p ? p.name : 'Not found'}</p>
    }

    await act(async () => {
      render(<PilotName />)
    })

    expect(screen.getByText('Zara Heln')).toBeTruthy()
  })

  test('returns null for unknown and undefined ids', async () => {
    useEntityStore.setState((s) => ({
      ...s,
      hydrated: { ...s.hydrated, pilots: true },
    }))

    function Probe() {
      const unknown = usePilot('nonexistent')
      const missing = usePilot(undefined)
      return (
        <p>
          {unknown === null ? 'unknown-null' : 'unknown-found'}{' '}
          {missing === null ? 'missing-null' : 'missing-found'}
        </p>
      )
    }

    await act(async () => {
      render(<Probe />)
    })

    expect(screen.getByText(/unknown-null/)).toBeTruthy()
    expect(screen.getByText(/missing-null/)).toBeTruthy()
  })

  test('an unrelated write does not re-render a by-id subscriber', async () => {
    await useEntityStore.getState().hydrate('mech')
    const a = await useEntityStore.getState().create('mech', baseMechInput)
    const b = await useEntityStore
      .getState()
      .create('mech', { ...baseMechInput, name: 'Rust Bucket' })

    const renderSpy = mock(() => {})
    function MechB() {
      renderSpy()
      const m = useMech(b.id)
      return <p>{m ? m.name : 'Not found'}</p>
    }

    await act(async () => {
      render(<MechB />)
    })
    const rendersAfterMount = renderSpy.mock.calls.length

    // Update mech A — update() maps the array and reuses untouched elements,
    // so mech B's reference (the selected value) is unchanged.
    await act(async () => {
      await useEntityStore.getState().update('mech', a.id, { name: 'Renamed' })
    })

    expect(renderSpy.mock.calls.length).toBe(rendersAfterMount)
    expect(screen.getByText('Rust Bucket')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Workspace hooks
// ---------------------------------------------------------------------------

describe('useWorkspaces / useWorkspace', () => {
  test('returns workspaces and auto-hydrates', async () => {
    await useWorkspaceStore.getState().hydrate()
    const ws = await useWorkspaceStore.getState().create({ name: 'Alpha Crew' })
    useWorkspaceStore.setState((s) => ({ ...s, hydrated: false }))

    function Probe() {
      const all = useWorkspaces()
      const one = useWorkspace(ws.id)
      const none = useWorkspace(null)
      return (
        <p>
          {all[0]?.name ?? 'empty'} / {one ? one.name : 'null'} /{' '}
          {none === null ? 'none-null' : 'none-found'}
        </p>
      )
    }

    await act(async () => {
      render(<Probe />)
    })

    await waitFor(() => {
      expect(screen.getByText(/Alpha Crew \/ Alpha Crew \/ none-null/)).toBeTruthy()
    })
    expect(useWorkspaceStore.getState().hydrated).toBe(true)
  })
})

describe('useWorkspaceActions', () => {
  test('returns working actions and never re-renders the consumer', async () => {
    await useWorkspaceStore.getState().hydrate()

    // Spy doubles as render counter and captures the hook's return value.
    const renderSpy = mock<(actions: ReturnType<typeof useWorkspaceActions>) => void>(() => {})
    function Probe() {
      renderSpy(useWorkspaceActions())
      return null
    }

    await act(async () => {
      render(<Probe />)
    })
    const actions = renderSpy.mock.calls.at(-1)?.[0]
    if (!actions) throw new Error('useWorkspaceActions was never captured')
    const rendersAfterMount = renderSpy.mock.calls.length

    await act(async () => {
      await actions.create({ name: 'Beta Crew' })
    })

    // Actions are identity-stable; the workspaces array change is not selected.
    expect(renderSpy.mock.calls.length).toBe(rendersAfterMount)
    expect(useWorkspaceStore.getState().workspaces.some((w) => w.name === 'Beta Crew')).toBe(true)
  })
})
