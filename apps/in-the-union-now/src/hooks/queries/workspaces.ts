/**
 * Query hooks over workspaceStore (design review T-7).
 *
 * Same contract as ./entities: typed reactive reads with the store's lazy
 * auto-hydration semantics. There is deliberately NO `useActiveWorkspace`
 * hook — the "active workspace" is page-local UI state (Dashboard and
 * EncounterScreen each keep their own `activeWorkspaceId` useState filter),
 * not store state.
 */

import { useShallow } from 'zustand/react/shallow'

import type { Workspace } from '../../lib/schemas/workspace'
import { useWorkspaceStore } from '../../stores/workspaceStore'

/** Full workspaceStore state+actions shape (what selectors receive). */
type WorkspaceStoreState = ReturnType<typeof useWorkspaceStore.getState>

/**
 * The workspace mutation surface, picked off the store. Matches the
 * injectable-store shapes used by the workspace components
 * (WorkspaceList/WorkspaceSwitcher/AssignToWorkspaceButton).
 */
type WorkspaceActions = Pick<
  WorkspaceStoreState,
  'create' | 'rename' | 'delete' | 'assign' | 'unassign'
>

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

function selectWorkspaces(state: WorkspaceStoreState): Workspace[] {
  return state.workspaces
}

function selectWorkspaceById(
  state: WorkspaceStoreState,
  id: string | null | undefined
): Workspace | null {
  if (!id) return null
  return state.workspaces.find((w) => w.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Lazy-hydration trigger — mirrors workspaceStore.list().
// ---------------------------------------------------------------------------

function ensureHydrated(): void {
  const state = useWorkspaceStore.getState()
  if (!state.hydrated) {
    void state.hydrate()
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Reactive list of all workspaces. Auto-triggers lazy hydration. */
export function useWorkspaces(): Workspace[] {
  ensureHydrated()
  return useWorkspaceStore(selectWorkspaces)
}

/** Reactive by-id read; null when missing/unhydrated or id is null/undefined. */
export function useWorkspace(id: string | null | undefined): Workspace | null {
  ensureHydrated()
  return useWorkspaceStore((s) => selectWorkspaceById(s, id))
}

/**
 * Stable workspace mutation actions (create/rename/delete/assign/unassign).
 * Zustand actions never change identity, so with useShallow this never
 * re-renders the consumer.
 */
export function useWorkspaceActions(): WorkspaceActions {
  return useWorkspaceStore(
    useShallow((s) => ({
      create: s.create,
      rename: s.rename,
      delete: s.delete,
      assign: s.assign,
      unassign: s.unassign,
    }))
  )
}
