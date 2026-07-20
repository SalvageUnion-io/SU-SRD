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

import { useState } from 'react'
import { Button, Input, ModalShell, FieldError } from 'component-lib'

import { useWorkspaceActions, useWorkspaces } from '../../hooks/queries'
import { DEFAULT_WORKSPACE_ID } from '../../lib/defaultWorkspace'
import type { Workspace } from '../../lib/schemas/workspace'
import { getActiveWorkspaceId, setActiveWorkspaceId } from '../../stores/activeWorkspaceStore'

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
// only run when the dialog is visible (and its state resets per open).
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
  const zustandWorkspaces = useWorkspaces()
  const workspaceActions = useWorkspaceActions()
  const activeStore: WorkspaceListStore = store ?? {
    workspaces: zustandWorkspaces,
    create: workspaceActions.create,
    rename: workspaceActions.rename,
    delete: workspaceActions.delete,
  }

  const [newName, setNewName] = useState('')
  const [createPending, setCreatePending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  /** id of the row currently being renamed, or null */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [renamePending, setRenamePending] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

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
    // The Default workspace is the mandatory fallback — never deletable.
    if (id === DEFAULT_WORKSPACE_ID) return
    await activeStore.delete(id)
    // Deleting the current workspace strands the view (members cascade to
    // Default) — follow them back to Default so the selection stays valid.
    if (getActiveWorkspaceId() === id) {
      setActiveWorkspaceId(DEFAULT_WORKSPACE_ID)
    }
    // If editing this row, cancel the edit
    if (editingId === id) {
      cancelEditing()
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Manage Workspaces"
      maxWidth="max-w-md"
    >
      <div className="bg-paper p-5">
        {/* Workspace rows */}
        {activeStore.workspaces.length === 0 ? (
          <p className="mb-4 font-body text-sm text-wk-muted">
            No workspaces yet. Create one below.
          </p>
        ) : (
          <ul className="mb-4 space-y-2" aria-label="Workspace list">
            {activeStore.workspaces.map((ws) => (
              <li
                key={ws.id}
                className="flex items-center gap-2 rounded-[3px] border-chrome border-ink bg-paper p-2"
              >
                {editingId === ws.id ? (
                  /* Editing row */
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleRename(ws.id)
                          if (e.key === 'Escape') cancelEditing()
                        }}
                        className="min-h-11 flex-1 px-3 py-1.5 sm:min-h-9"
                        aria-label={`Rename workspace ${ws.name}`}
                      />
                      <Button
                        variant="primary"
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
                    {renameError && <FieldError>{renameError}</FieldError>}
                  </div>
                ) : (
                  /* Idle row */
                  <>
                    <span className="flex-1 font-body text-sm font-medium text-ink">{ws.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(ws)}
                      aria-label={`Rename workspace ${ws.name}`}
                    >
                      Rename
                    </Button>
                    {/* The Default workspace is the mandatory fallback — it can
                        be renamed but never deleted. */}
                    {ws.id !== DEFAULT_WORKSPACE_ID && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete(ws.id)}
                        aria-label={`Delete workspace ${ws.name}`}
                        className="text-danger hover:text-danger"
                      >
                        Delete
                      </Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Create form */}
        <div className="border-t-chrome border-ink pt-4">
          <p className="font-cond mb-2 text-caption font-bold uppercase tracking-widest text-rust">
            New Workspace
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
              placeholder="Campaign name…"
              className="flex-1 px-3 py-1.5"
              aria-label="New workspace name"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleCreate()}
              disabled={createPending}
              aria-label="Create workspace"
            >
              {createPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
          {createError && <FieldError className="mt-1">{createError}</FieldError>}
        </div>
      </div>
    </ModalShell>
  )
}
