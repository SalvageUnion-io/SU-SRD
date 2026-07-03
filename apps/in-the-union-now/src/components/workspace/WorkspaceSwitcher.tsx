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

import { useWorkspaceActions, useWorkspaces } from '../../hooks/queries'
import type { Workspace } from '../../lib/schemas/workspace'
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
  const zustandWorkspaces = useWorkspaces()
  const workspaceActions = useWorkspaceActions()
  const activeStore: WorkspaceSwitcherStore = store ?? {
    workspaces: zustandWorkspaces,
    create: workspaceActions.create,
    rename: workspaceActions.rename,
    delete: workspaceActions.delete,
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
        <label
          htmlFor="workspace-switcher"
          className="font-cond text-caption font-semibold uppercase tracking-caps-tight text-ink"
        >
          Workspace
        </label>
        {/* Faux-select (design-spec §2.5): reuses the `.input` recipe */}
        <span className="relative inline-block">
          <select
            id="workspace-switcher"
            value={selectValue}
            onChange={handleChange}
            className="w-[200px] min-h-11 cursor-pointer appearance-none rounded-[3px] border-chrome border-ink bg-paper py-2 pl-3 pr-8 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22] sm:min-h-9"
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
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-wk-muted"
          >
            ▾
          </span>
        </span>
      </div>

      <WorkspaceList open={manageOpen} onClose={() => setManageOpen(false)} store={activeStore} />
    </>
  )
}
