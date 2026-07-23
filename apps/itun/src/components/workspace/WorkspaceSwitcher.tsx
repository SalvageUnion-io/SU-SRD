/**
 * WorkspaceSwitcher — Roster / Encounter header control.
 *
 * Renders a <select> with:
 *   - One option per real workspace
 *   - A synthetic "Default workspace" option (fallback until the v10 migration's
 *     record is hydrated) — the current-workspace model always has a current
 *     workspace, so there is no "All Builds" entry any more
 *   - A synthetic "Starter Set" option (until it is spawned into this browser)
 *   - "Manage workspaces…" option (value = "__manage__") — opens WorkspaceList modal
 *
 * Props:
 *   activeWorkspaceId — currently selected workspace id (always concrete)
 *   onSelect          — called when a workspace is selected
 *   store             — injectable store slice for testability
 *
 * WorkspaceList modal is managed internally via local state.
 */

import { useState } from 'react'
import { Select } from 'component-lib'

import { useWorkspaceActions, useWorkspaces } from '../../hooks/queries'
import { DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME } from '../../lib/defaultWorkspace'
import type { Workspace } from '../../lib/schemas/workspace'
import { STARTER_WORKSPACE_ID } from '../../lib/starterSet/starterSet'
import { ELDRIDGE_WORKSPACE_ID } from '../../lib/eldridgeCoast/eldridgeCoast'
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

const MANAGE_VALUE = '__manage__'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WorkspaceSwitcherProps = {
  activeWorkspaceId: string
  onSelect: (workspaceId: string) => void
  /** Inject to avoid Zustand global in tests. */
  store?: WorkspaceSwitcherStore
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceSwitcher({ activeWorkspaceId, onSelect, store }: WorkspaceSwitcherProps) {
  const zustandWorkspaces = useWorkspaces()
  const workspaceActions = useWorkspaceActions()
  const activeStore: WorkspaceSwitcherStore = store ?? {
    workspaces: zustandWorkspaces,
    create: workspaceActions.create,
    rename: workspaceActions.rename,
    delete: workspaceActions.delete,
  }

  const [manageOpen, setManageOpen] = useState(false)

  const selectValue = activeWorkspaceId

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === MANAGE_VALUE) {
      setManageOpen(true)
      return
    }
    onSelect(val)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <label
          htmlFor="workspace-switcher"
          className="font-cond text-caption font-semibold uppercase tracking-caps-tight text-ink"
        >
          Workspace
        </label>
        {/* Faux-select (design-spec §2.5): the shared `Select` chevron rung. */}
        <Select
          chevron
          id="workspace-switcher"
          value={selectValue}
          onChange={handleChange}
          className="w-[200px] sm:min-h-9"
          aria-label="Select workspace"
        >
          {/* The built-in Default workspace always exists (created by the v10
              migration). Surface it synthetically if the migration's record
              hasn't hydrated into the store yet, so the current selection is
              never an option-less value. */}
          {!activeStore.workspaces.some((ws) => ws.id === DEFAULT_WORKSPACE_ID) && (
            <option value={DEFAULT_WORKSPACE_ID}>{DEFAULT_WORKSPACE_NAME}</option>
          )}
          {activeStore.workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
          {/* The built-in Starter Set is always selectable. Until the user
              first opens it (which spawns it into this browser) it isn't yet a
              real workspace, so surface it here as a synthetic option. */}
          {!activeStore.workspaces.some((ws) => ws.id === STARTER_WORKSPACE_ID) && (
            <option value={STARTER_WORKSPACE_ID}>Starter Set</option>
          )}
          {/* The built-in Eldridge Coast campaign is likewise always
              selectable; surfaced synthetically until first opened. */}
          {!activeStore.workspaces.some((ws) => ws.id === ELDRIDGE_WORKSPACE_ID) && (
            <option value={ELDRIDGE_WORKSPACE_ID}>The Eldridge Coast</option>
          )}
          <option value={MANAGE_VALUE}>Manage workspaces…</option>
        </Select>
      </div>

      <WorkspaceList open={manageOpen} onClose={() => setManageOpen(false)} store={activeStore} />
    </>
  )
}
