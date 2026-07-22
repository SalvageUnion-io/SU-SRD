/**
 * WorkspaceSwitcher component tests.
 *
 * Uses dep-injection (store prop) — no mock.module(), no Zustand globals.
 * Uses .toBeTruthy() per project convention.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { DEFAULT_WORKSPACE_ID } from '../../../lib/defaultWorkspace'
import type { Workspace } from '../../../lib/schemas/workspace'
import type { WorkspaceSwitcherStore } from '../WorkspaceSwitcher'
import { WorkspaceSwitcher } from '../WorkspaceSwitcher'

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

function makeStore(workspaces: Workspace[] = []): WorkspaceSwitcherStore {
  return {
    workspaces,
    create: mock(async () => makeWorkspace('new', 'New')),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    rename: mock(async (_id: string, _name: string) => makeWorkspace('x', 'x')),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    delete: mock(async (_id: string) => {}),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkspaceSwitcher — render', () => {
  test('renders the workspace select', () => {
    render(
      <WorkspaceSwitcher
        activeWorkspaceId={DEFAULT_WORKSPACE_ID}
        onSelect={() => {}}
        store={makeStore()}
      />
    )
    expect(screen.getByRole('combobox', { name: /select workspace/i })).toBeTruthy()
  })

  test('there is no "All Builds" option — a synthetic Default workspace is offered instead', () => {
    render(
      <WorkspaceSwitcher
        activeWorkspaceId={DEFAULT_WORKSPACE_ID}
        onSelect={() => {}}
        store={makeStore()}
      />
    )
    expect(screen.queryByRole('option', { name: /all builds/i })).toBeNull()
    const select = screen.getByRole<HTMLSelectElement>('combobox')
    // Falls back to the synthetic Default option when the store has no record yet.
    expect(select.value).toBe(DEFAULT_WORKSPACE_ID)
    expect(screen.getByRole('option', { name: /default workspace/i })).toBeTruthy()
  })

  test('workspace options are rendered', () => {
    const ws1 = makeWorkspace('ws-1', 'Alpha')
    const ws2 = makeWorkspace('ws-2', 'Beta')
    render(
      <WorkspaceSwitcher
        activeWorkspaceId="ws-1"
        onSelect={() => {}}
        store={makeStore([ws1, ws2])}
      />
    )
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Beta' })).toBeTruthy()
  })

  test('active workspace is pre-selected', () => {
    const ws = makeWorkspace('ws-1', 'Active Campaign')
    render(
      <WorkspaceSwitcher activeWorkspaceId="ws-1" onSelect={() => {}} store={makeStore([ws])} />
    )
    const select = screen.getByRole<HTMLSelectElement>('combobox')
    expect(select.value).toBe('ws-1')
  })
})

describe('WorkspaceSwitcher — selection', () => {
  test('selecting a workspace calls onSelect with that workspace id', async () => {
    const ws = makeWorkspace('ws-1', 'Campaign')
    const onSelect = mock((id: string) => {
      void id
    })
    render(
      <WorkspaceSwitcher
        activeWorkspaceId={DEFAULT_WORKSPACE_ID}
        onSelect={onSelect}
        store={makeStore([ws])}
      />
    )

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ws-1' } })
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0]).toBe('ws-1')
  })

  test('selecting "Manage workspaces…" opens WorkspaceList modal', async () => {
    render(
      <WorkspaceSwitcher
        activeWorkspaceId={DEFAULT_WORKSPACE_ID}
        onSelect={() => {}}
        store={makeStore()}
      />
    )

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '__manage__' } })
    })

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('selecting "Manage workspaces…" does not call onSelect', async () => {
    const onSelect = mock((id: string) => {
      void id
    })
    render(
      <WorkspaceSwitcher
        activeWorkspaceId={DEFAULT_WORKSPACE_ID}
        onSelect={onSelect}
        store={makeStore()}
      />
    )

    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '__manage__' } })
    })

    expect(onSelect).toHaveBeenCalledTimes(0)
  })
})
