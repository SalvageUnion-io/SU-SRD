/**
 * activeWorkspaceStore — the app's single "current workspace".
 *
 * Workspaces are the organizing primitive (there is no cross-workspace "All
 * Builds" view), so there is always exactly one current workspace. It defaults
 * to the built-in Default workspace (lib/defaultWorkspace) and is persisted to
 * localStorage so it survives reloads and navigation — unlike the old
 * page-local `useState` selector each surface used to keep.
 *
 * The current workspace drives three things:
 *   - which builds the Roster / Encounter tray show,
 *   - which workspace a brand-new build is stamped with (entityStore.create),
 *   - which assets the Dashboard launch chooser offers.
 *
 * Deliberately dumb: it holds a raw id. Guaranteeing that id points at a real
 * workspace is the caller's job — the v10 migration guarantees the Default
 * workspace always exists, and the workspace-delete flow resets the current
 * workspace back to Default when the active one is removed.
 */

import { create } from 'zustand'

import { DEFAULT_WORKSPACE_ID } from '../lib/defaultWorkspace'

const STORAGE_KEY = 'itun.activeWorkspaceId'

function readPersisted(): string {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_WORKSPACE_ID
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_WORKSPACE_ID
  } catch {
    return DEFAULT_WORKSPACE_ID
  }
}

function writePersisted(id: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // best-effort — a private-mode localStorage throw must not break selection
  }
}

type ActiveWorkspaceState = {
  activeWorkspaceId: string
  setActiveWorkspaceId: (id: string) => void
}

export const useActiveWorkspaceStore = create<ActiveWorkspaceState>((set) => ({
  activeWorkspaceId: readPersisted(),
  setActiveWorkspaceId(id) {
    writePersisted(id)
    set({ activeWorkspaceId: id })
  },
}))

/** Reactive read of the current workspace id. */
export function useActiveWorkspaceId(): string {
  return useActiveWorkspaceStore((s) => s.activeWorkspaceId)
}

/** Non-React read of the current workspace id (e.g. from entityStore.create). */
export function getActiveWorkspaceId(): string {
  return useActiveWorkspaceStore.getState().activeWorkspaceId
}

/** Non-React setter for the current workspace id. */
export function setActiveWorkspaceId(id: string): void {
  useActiveWorkspaceStore.getState().setActiveWorkspaceId(id)
}
