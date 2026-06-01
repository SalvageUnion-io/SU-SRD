/**
 * WorkspaceList — modal listing all workspaces with Create / Rename / Delete actions.
 *
 * Props:
 *   open        — controls whether the modal is visible
 *   onClose     — called when the modal should be dismissed
 *   store       — injectable workspaceStore slice for testability
 *                 (omit in production; falls back to useWorkspaceStore)
 *
 * State machine per workspace row:
 *   idle → editing (user clicks Rename) → idle (confirm or cancel)
 *
 * Delete: clicking Delete on a row calls store.delete immediately (no confirm dialog —
 * the action is soft in MVP since entities are not cascade-deleted; see workspaceStore
 * module docblock for the "orphaned entity" semantics).
 */

import { useRef, useState } from 'react'

import type { Workspace } from '../../lib/schemas/workspace'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useDialogA11y } from '../shared/useDialogA11y'
import { Button } from '../ui/button'

// ---------------------------------------------------------------------------
// Injectable store type (for dep-injection in tests)
// ---------------------------------------------------------------------------

export type WorkspaceListStore = {
  workspaces: Workspace[]
  create: (input: { name: string }) => Promise<Workspace>
  rename: (id: string, name: string) => Promise<Workspace>
  delete: (id: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WorkspaceListProps = {
  open: boolean
  onClose: () => void
  /** Inject to avoid Zustand global in tests. */
  store?: WorkspaceListStore
}

// ---------------------------------------------------------------------------
// Outer component — gates rendering on `open` so the inner component's hooks
// (including useDialogA11y) only run when the dialog is visible.
// ---------------------------------------------------------------------------

export function WorkspaceList({ open, onClose, store }: WorkspaceListProps) {
  if (!open) return null
  return <WorkspaceListInner onClose={onClose} store={store} />
}

// ---------------------------------------------------------------------------
// Inner component (always mounted when open)
// ---------------------------------------------------------------------------

type WorkspaceListInnerProps = {
  onClose: () => void
  store?: WorkspaceListStore
}

function WorkspaceListInner({ onClose, store }: WorkspaceListInnerProps) {
  const zustandStore = useWorkspaceStore()
  const activeStore: WorkspaceListStore = store ?? {
    workspaces: zustandStore.workspaces,
    create: zustandStore.create,
    rename: zustandStore.rename,
    delete: zustandStore.delete,
  }

  const [newName, setNewName] = useState('')
  const [createPending, setCreatePending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  /** id of the row currently being renamed, or null */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [renamePending, setRenamePending] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose })

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    const name = newName.trim()
    if (!name) {
      setCreateError('Name is required.')
      return
    }
    setCreatePending(true)
    setCreateError(null)
    try {
      await activeStore.create({ name })
      setNewName('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace.')
    } finally {
      setCreatePending(false)
    }
  }

  function startEditing(ws: Workspace) {
    setEditingId(ws.id)
    setEditName(ws.name)
    setRenameError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditName('')
    setRenameError(null)
  }

  async function handleRename(id: string) {
    const name = editName.trim()
    if (!name) {
      setRenameError('Name is required.')
      return
    }
    setRenamePending(true)
    setRenameError(null)
    try {
      await activeStore.rename(id, name)
      setEditingId(null)
      setEditName('')
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename workspace.')
    } finally {
      setRenamePending(false)
    }
  }

  async function handleDelete(id: string) {
    await activeStore.delete(id)
    // If editing this row, cancel the edit
    if (editingId === id) {
      cancelEditing()
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-list-title"
        className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="workspace-list-title" className="text-base font-semibold">
            Manage Workspaces
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close workspace manager">
            ✕
          </Button>
        </div>

        {/* Workspace rows */}
        {activeStore.workspaces.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">No workspaces yet. Create one below.</p>
        ) : (
          <ul className="mb-4 space-y-2" aria-label="Workspace list">
            {activeStore.workspaces.map((ws) => (
              <li
                key={ws.id}
                className="flex items-center gap-2 rounded-md border border-border p-2"
              >
                {editingId === ws.id ? (
                  /* Editing row */
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleRename(ws.id)
                          if (e.key === 'Escape') cancelEditing()
                        }}
                        className="flex-1 rounded border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={`Rename workspace ${ws.name}`}
                      />
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => void handleRename(ws.id)}
                        disabled={renamePending}
                        aria-label={`Confirm rename workspace`}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={renamePending}
                        aria-label={`Cancel rename workspace ${ws.name}`}
                      >
                        Cancel
                      </Button>
                    </div>
                    {renameError && (
                      <p className="text-xs text-destructive" role="alert">
                        {renameError}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Idle row */
                  <>
                    <span className="flex-1 text-sm font-medium">{ws.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(ws)}
                      aria-label={`Rename workspace ${ws.name}`}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(ws.id)}
                      aria-label={`Delete workspace ${ws.name}`}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Create form */}
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            New Workspace
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
              placeholder="Campaign name…"
              className="flex-1 rounded border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="New workspace name"
            />
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleCreate()}
              disabled={createPending}
              aria-label="Create workspace"
            >
              {createPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
          {createError && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {createError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
