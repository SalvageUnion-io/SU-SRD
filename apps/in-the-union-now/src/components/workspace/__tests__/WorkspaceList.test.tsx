/**
 * WorkspaceList component tests.
 *
 * Uses dep-injection (store prop) — no mock.module(), no Zustand globals.
 * Uses .toBeTruthy() / .toBeFalsy() per project convention (no jest-dom type augmentation).
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { Workspace } from '../../../lib/schemas/workspace'
import type { WorkspaceListStore } from '../WorkspaceList'
import { WorkspaceList } from '../WorkspaceList'

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

type CreateFn = ReturnType<typeof mock<(input: { name: string }) => Promise<Workspace>>>
type RenameFn = ReturnType<typeof mock<(id: string, name: string) => Promise<Workspace>>>
type DeleteFn = ReturnType<typeof mock<(id: string) => Promise<void>>>

type FakeStore = WorkspaceListStore & {
  createFn: CreateFn
  renameFn: RenameFn
  deleteFn: DeleteFn
}

function makeStore(workspaces: Workspace[] = []): FakeStore {
  const createFn: CreateFn = mock(async (input: { name: string }) => {
    const ws = makeWorkspace(`ws-new-${Date.now()}`, input.name)
    workspaces.push(ws)
    return ws
  })

  const renameFn: RenameFn = mock(async (id: string, name: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) throw new Error('Not found')
    ws.name = name
    return ws
  })

  const deleteFn: DeleteFn = mock(async (id: string) => {
    const idx = workspaces.findIndex((w) => w.id === id)
    if (idx !== -1) workspaces.splice(idx, 1)
  })

  return {
    workspaces,
    create: createFn,
    rename: renameFn,
    delete: deleteFn,
    createFn,
    renameFn,
    deleteFn,
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

beforeEach(() => {})
afterEach(() => {})

// ---------------------------------------------------------------------------
// Closed state
// ---------------------------------------------------------------------------

describe('WorkspaceList — closed', () => {
  test('renders nothing when open=false', () => {
    const store = makeStore()
    render(<WorkspaceList open={false} onClose={() => {}} store={store} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Open state
// ---------------------------------------------------------------------------

describe('WorkspaceList — open with no workspaces', () => {
  test('renders dialog', () => {
    const store = makeStore()
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('shows empty state message', () => {
    const store = makeStore()
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)
    expect(screen.getByText(/no workspaces yet/i)).toBeTruthy()
  })

  test('close button calls onClose', async () => {
    const onClose = mock(() => {})
    const store = makeStore()
    render(<WorkspaceList open={true} onClose={onClose} store={store} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /close workspace manager/i }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Create workspace
// ---------------------------------------------------------------------------

describe('WorkspaceList — create', () => {
  test('typing a name and clicking Create calls store.create', async () => {
    const store = makeStore()
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    const input = screen.getByRole('textbox', { name: /new workspace name/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Campaign Alpha' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }))
    })

    expect(store.createFn).toHaveBeenCalledTimes(1)
    expect(store.createFn.mock.calls[0]?.[0]).toEqual({ name: 'Campaign Alpha' })
  })

  test('pressing Enter in the input calls store.create', async () => {
    const store = makeStore()
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    const input = screen.getByRole('textbox', { name: /new workspace name/i })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Beta' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(store.createFn).toHaveBeenCalledTimes(1)
  })

  test('shows error when name is empty', async () => {
    const store = makeStore()
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }))
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(store.createFn).toHaveBeenCalledTimes(0)
  })
})

// ---------------------------------------------------------------------------
// Workspace list
// ---------------------------------------------------------------------------

describe('WorkspaceList — list shows existing workspaces', () => {
  test('renders workspace names', () => {
    const ws1 = makeWorkspace('ws-1', 'Gamma Campaign')
    const ws2 = makeWorkspace('ws-2', 'Side Quest')
    const store = makeStore([ws1, ws2])
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    expect(screen.getByText('Gamma Campaign')).toBeTruthy()
    expect(screen.getByText('Side Quest')).toBeTruthy()
  })

  test('renders Rename and Delete buttons per row', () => {
    const ws = makeWorkspace('ws-1', 'My Campaign')
    const store = makeStore([ws])
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    expect(screen.getByRole('button', { name: /rename workspace My Campaign/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /delete workspace My Campaign/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

describe('WorkspaceList — rename', () => {
  test('clicking Rename shows an input pre-filled with the current name', async () => {
    const ws = makeWorkspace('ws-1', 'Old Name')
    const store = makeStore([ws])
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Old Name/i }))
    })

    const editInput = screen.getByRole('textbox', { name: /rename workspace Old Name/i })
    expect((editInput as HTMLInputElement).value).toBe('Old Name')
  })

  test('saving calls store.rename with new name', async () => {
    const ws = makeWorkspace('ws-1', 'Old Name')
    const store = makeStore([ws])
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Old Name/i }))
    })

    const editInput = screen.getByRole('textbox', { name: /rename workspace Old Name/i })
    await act(async () => {
      fireEvent.change(editInput, { target: { value: 'New Name' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm rename workspace/i }))
    })

    expect(store.renameFn).toHaveBeenCalledTimes(1)
    expect(store.renameFn.mock.calls[0]).toEqual(['ws-1', 'New Name'])
  })

  test('cancelling rename restores idle state', async () => {
    const ws = makeWorkspace('ws-1', 'Stable Name')
    const store = makeStore([ws])
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Stable Name/i }))
    })

    // Cancel button should be present in edit mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    })

    // Back to idle row: Rename button visible again
    expect(screen.getByRole('button', { name: /rename workspace Stable Name/i })).toBeTruthy()
    expect(store.renameFn).toHaveBeenCalledTimes(0)
  })
})

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe('WorkspaceList — delete', () => {
  test('clicking Delete calls store.delete', async () => {
    const ws = makeWorkspace('ws-1', 'Doomed Campaign')
    const store = makeStore([ws])
    render(<WorkspaceList open={true} onClose={() => {}} store={store} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete workspace Doomed Campaign/i }))
    })

    expect(store.deleteFn).toHaveBeenCalledTimes(1)
    expect(store.deleteFn.mock.calls[0]?.[0]).toBe('ws-1')
  })

  test('after delete the workspace is removed from the list', async () => {
    // We simulate a reactive store where deleting mutates the array and re-renders.
    // Because our fake store is injected as a prop (stable object), we use a
    // controlled component pattern: re-render with updated workspaces array.
    const workspaces: Workspace[] = [makeWorkspace('ws-1', 'To Remove')]
    const store = makeStore(workspaces)

    const { rerender } = render(
      <WorkspaceList open={true} onClose={() => {}} store={{ ...store, workspaces }} />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete workspace To Remove/i }))
    })

    // After delete, splice removed it from the array; re-render with updated store
    rerender(<WorkspaceList open={true} onClose={() => {}} store={{ ...store, workspaces }} />)

    await waitFor(() => {
      expect(screen.queryByText('To Remove')).toBeFalsy()
    })
  })
})
