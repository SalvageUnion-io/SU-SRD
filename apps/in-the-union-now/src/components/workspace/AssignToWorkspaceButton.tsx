/**
 * AssignToWorkspaceButton — entity detail view affordance.
 *
 * Renders a <select> showing all workspaces (plus "Unassigned" option).
 * When the user selects a workspace, calls store.assign(entityType, entityId, workspaceId).
 * When the user selects "Unassigned", calls store.unassign(entityType, entityId).
 *
 * Props:
 *   entityType       — 'pilot' | 'mech' | 'crawler'
 *   entityId         — id of the entity being assigned
 *   currentWorkspaceId — currently assigned workspace id, or undefined/null
 *   store            — injectable store slice for testability
 *
 * Uses a select control (not a dialog) for minimal friction — the user can
 * move entities between workspaces in one tap, consistent with the low-ceremony
 * ITUN UX.
 */

import { useState } from 'react'

import type { Workspace } from '../../lib/schemas/workspace'
import type { AssignableType } from '../../stores/types'
import { useWorkspaceStore } from '../../stores/workspaceStore'

// ---------------------------------------------------------------------------
// Injectable store type
// ---------------------------------------------------------------------------

export type AssignToWorkspaceStore = {
  workspaces: Workspace[]
  assign: (entityType: AssignableType, entityId: string, workspaceId: string) => Promise<void>
  unassign: (entityType: AssignableType, entityId: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNASSIGNED_VALUE = '__unassigned__'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type AssignToWorkspaceButtonProps = {
  entityType: AssignableType
  entityId: string
  currentWorkspaceId?: string | null
  /** Inject to avoid Zustand global in tests. */
  store?: AssignToWorkspaceStore
  onChanged?: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssignToWorkspaceButton({
  entityType,
  entityId,
  currentWorkspaceId,
  store,
  onChanged,
  className,
}: AssignToWorkspaceButtonProps) {
  const zustandStore = useWorkspaceStore()
  const activeStore: AssignToWorkspaceStore = store ?? {
    workspaces: zustandStore.workspaces,
    assign: zustandStore.assign,
    unassign: zustandStore.unassign,
  }

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectValue = currentWorkspaceId ?? UNASSIGNED_VALUE

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setPending(true)
    setError(null)
    try {
      if (val === UNASSIGNED_VALUE) {
        await activeStore.unassign(entityType, entityId)
      } else {
        await activeStore.assign(entityType, entityId, val)
      }
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workspace assignment.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label
          htmlFor={`workspace-assign-${entityId}`}
          className="text-sm font-medium text-muted-foreground"
        >
          Workspace:
        </label>
        <select
          id={`workspace-assign-${entityId}`}
          value={selectValue}
          onChange={(e) => void handleChange(e)}
          disabled={pending}
          className="rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          aria-label="Assign to workspace"
        >
          <option value={UNASSIGNED_VALUE}>Unassigned</option>
          {activeStore.workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
