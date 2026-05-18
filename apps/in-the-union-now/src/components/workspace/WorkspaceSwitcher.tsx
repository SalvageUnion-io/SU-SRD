/**
 * WorkspaceSwitcher — Dashboard header control.
 *
 * Renders a <select> with:
 *   - "All Builds" option (value = "__all__") — shows all unassigned entities
 *   - One option per workspace
 *   - "Manage workspaces…" option (value = "__manage__") — opens WorkspaceList modal
 *
 * Props:
 *   activeWorkspaceId — currently selected workspace id, or null for "All Builds"
 *   onSelect          — called when a workspace (or "__all__") is selected
 *   store             — injectable store slice for testability
 *
 * WorkspaceList modal is managed internally via local state.
 */

import { useState } from 'react'

import type { Workspace } from '../../lib/schemas/workspace'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { WorkspaceList } from './WorkspaceList'
import type { WorkspaceListStore } from './WorkspaceList'

// ---------------------------------------------------------------------------
// Injectable store type
// ---------------------------------------------------------------------------

export type WorkspaceSwitcherStore = WorkspaceListStore & {
  workspaces: Workspace[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export const ALL_BUILDS_VALUE = '__all__'
const MANAGE_VALUE = '__manage__'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WorkspaceSwitcherProps = {
  activeWorkspaceId: string | null
  onSelect: (workspaceId: string | null) => void
  /** Inject to avoid Zustand global in tests. */
  store?: WorkspaceSwitcherStore
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceSwitcher({ activeWorkspaceId, onSelect, store }: WorkspaceSwitcherProps) {
  const zustandStore = useWorkspaceStore()
  const activeStore: WorkspaceSwitcherStore = store ?? {
    workspaces: zustandStore.workspaces,
    create: zustandStore.create,
    rename: zustandStore.rename,
    delete: zustandStore.delete,
  }

  const [manageOpen, setManageOpen] = useState(false)

  const selectValue = activeWorkspaceId ?? ALL_BUILDS_VALUE

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === MANAGE_VALUE) {
      setManageOpen(true)
      return
    }
    onSelect(val === ALL_BUILDS_VALUE ? null : val)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="workspace-switcher" className="text-sm font-medium text-muted-foreground">
          Workspace:
        </label>
        <select
          id="workspace-switcher"
          value={selectValue}
          onChange={handleChange}
          className="rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Select workspace"
        >
          <option value={ALL_BUILDS_VALUE}>All Builds</option>
          {activeStore.workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
          <option value={MANAGE_VALUE}>Manage workspaces…</option>
        </select>
      </div>

      <WorkspaceList open={manageOpen} onClose={() => setManageOpen(false)} store={activeStore} />
    </>
  )
}
