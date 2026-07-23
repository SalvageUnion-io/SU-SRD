/**
 * AssignToWorkspaceButton component tests.
 *
 * Uses dep-injection (store prop) — no mock.module(), no Zustand globals.
 * Uses .toBeTruthy() per project convention.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

import type { Workspace } from '../../../lib/schemas/workspace'
import type { AssignToWorkspaceStore } from '../AssignToWorkspaceButton'
import { AssignToWorkspaceButton } from '../AssignToWorkspaceButton'
import type { AssignableType } from '../../../stores/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkspace(id: string, name: string): Workspace {
  return {
    id,
    name,
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
  }
}

type AssignFn = ReturnType<
  typeof mock<(entityType: AssignableType, entityId: string, workspaceId: string) => Promise<void>>
>
type UnassignFn = ReturnType<
  typeof mock<(entityType: AssignableType, entityId: string) => Promise<void>>
>

type FakeStore = AssignToWorkspaceStore & {
  assignFn: AssignFn
  unassignFn: UnassignFn
}

function makeStore(workspaces: Workspace[] = []): FakeStore {
  const assignFn: AssignFn = mock(
    async (entityType: string, entityId: string, workspaceId: string) => {
      void entityType
      void entityId
      void workspaceId
    }
  )
  const unassignFn: UnassignFn = mock(async (entityType: string, entityId: string) => {
    void entityType
    void entityId
  })
  return {
    workspaces,
    assign: assignFn,
    unassign: unassignFn,
    assignFn,
    unassignFn,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssignToWorkspaceButton — render', () => {
  test('renders the workspace assign select', () => {
    render(<AssignToWorkspaceButton entityType="pilot" entityId="pilot-1" store={makeStore()} />)
    expect(screen.getByRole('combobox', { name: /assign to workspace/i })).toBeTruthy()
  })

  test('defaults to "Unassigned" when no currentWorkspaceId', () => {
    render(<AssignToWorkspaceButton entityType="pilot" entityId="pilot-1" store={makeStore()} />)
    const select = screen.getByRole<HTMLSelectElement>('combobox')
    expect(select.value).toBe('__unassigned__')
  })

  test('shows current workspace as selected', () => {
    const ws = makeWorkspace('ws-1', 'My Campaign')
    render(
      <AssignToWorkspaceButton
        entityType="mech"
        entityId="mech-1"
        currentWorkspaceId="ws-1"
        store={makeStore([ws])}
      />
    )
    const select = screen.getByRole<HTMLSelectElement>('combobox')
    expect(select.value).toBe('ws-1')
  })

  test('workspace options are rendered', () => {
    const ws1 = makeWorkspace('ws-1', 'Alpha')
    const ws2 = makeWorkspace('ws-2', 'Beta')
    render(
      <AssignToWorkspaceButton
        entityType="crawler"
        entityId="crawler-1"
        store={makeStore([ws1, ws2])}
      />
    )
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Beta' })).toBeTruthy()
  })
})

describe('AssignToWorkspaceButton — assign', () => {
  test('selecting a workspace calls store.assign with entityType, entityId, workspaceId', async () => {
    const ws = makeWorkspace('ws-1', 'Campaign')
    const store = makeStore([ws])
    render(<AssignToWorkspaceButton entityType="pilot" entityId="pilot-99" store={store} />)

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    })

    expect(store.assignFn).toHaveBeenCalledTimes(1)
    expect(store.assignFn.mock.calls[0]).toEqual(['pilot', 'pilot-99', 'ws-1'])
  })

  test('selecting "Unassigned" calls store.unassign', async () => {
    const ws = makeWorkspace('ws-1', 'Campaign')
    const store = makeStore([ws])
    render(
      <AssignToWorkspaceButton
        entityType="mech"
        entityId="mech-42"
        currentWorkspaceId="ws-1"
        store={store}
      />
    )

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '__unassigned__' } })
    })

    expect(store.unassignFn).toHaveBeenCalledTimes(1)
    expect(store.unassignFn.mock.calls[0]).toEqual(['mech', 'mech-42'])
  })

  test('onChanged callback fires after successful assignment', async () => {
    const ws = makeWorkspace('ws-1', 'Campaign')
    const store = makeStore([ws])
    const onChanged = mock(() => {})
    render(
      <AssignToWorkspaceButton
        entityType="crawler"
        entityId="crawler-7"
        onChanged={onChanged}
        store={store}
      />
    )

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    })

    expect(onChanged).toHaveBeenCalledTimes(1)
  })
})
