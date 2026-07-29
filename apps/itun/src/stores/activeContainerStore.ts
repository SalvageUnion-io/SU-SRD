/**
 * activeContainerStore — the app's single "current container" (ADR-030 §2).
 *
 * Replaces `activeWorkspaceStore`. Workspaces are gone; an entity lives in
 * exactly one of two places, a shared **Game** or the owner's personal
 * **Shelf**, and this store holds whichever of those the user is currently
 * looking at.
 *
 * ## It only means anything in Connected mode
 *
 * A Solo user has no Games — there is no account, so there is nothing to share
 * with. Their entities are one pile, and surfaces render that pile whole rather
 * than filtering it. This store still resolves (to the Shelf) in Solo so
 * callers need no branch, but nothing consults it there.
 *
 * That is deliberate and load-bearing rather than a shortcut. Migration v13
 * mapped every non-Default workspace onto `gameId: <that workspace id>`, so a
 * Solo user who once made custom workspaces now has entities addressed by ids
 * that match no real Game. Filtering a Solo roster by container would render
 * those invisible — the user would open the app and find builds missing. Not
 * filtering at all is both simpler and the only answer that cannot lose them.
 *
 * ## Persistence
 *
 * Serialized as a single string — `shelf`, or `game:<id>` — because the pair
 * (kind, id) is one decision and two keys could contradict each other. The
 * value survives reloads and navigation, like the workspace id it replaces.
 */

import { create } from 'zustand'

import { SHELF } from '../lib/container'
import type { Container } from '../lib/container'

const STORAGE_KEY = 'itun.activeContainer'

/** `shelf` | `game:<id>` — see the note on persistence above. */
export function serializeContainer(container: Container): string {
  return container.kind === 'game' ? `game:${container.gameId}` : 'shelf'
}

/**
 * Parse a persisted container, falling back to the Shelf.
 *
 * Anything unrecognized resolves to the Shelf rather than throwing: this value
 * comes from localStorage, which a previous build, another tab, or the user
 * themselves may have written. A roster that refuses to render because a
 * string was malformed would be a worse failure than one showing the Shelf.
 */
export function parseContainer(raw: string | null): Container {
  if (raw === null || raw === 'shelf') return SHELF
  if (raw.startsWith('game:')) {
    const gameId = raw.slice('game:'.length)
    if (gameId.length > 0) return { kind: 'game', gameId }
  }
  return SHELF
}

function readPersisted(): Container {
  try {
    if (typeof localStorage === 'undefined') return SHELF
    return parseContainer(localStorage.getItem(STORAGE_KEY))
  } catch {
    return SHELF
  }
}

function writePersisted(container: Container): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, serializeContainer(container))
  } catch {
    // best-effort — a private-mode localStorage throw must not break selection
  }
}

type ActiveContainerState = {
  activeContainer: Container
  setActiveContainer: (container: Container) => void
}

export const useActiveContainerStore = create<ActiveContainerState>((set) => ({
  activeContainer: readPersisted(),
  setActiveContainer(container) {
    writePersisted(container)
    set({ activeContainer: container })
  },
}))

/** Reactive read of the current container. */
export function useActiveContainer(): Container {
  return useActiveContainerStore((s) => s.activeContainer)
}

/** Non-React read (e.g. from entityStore.create, which is not a component). */
export function getActiveContainer(): Container {
  return useActiveContainerStore.getState().activeContainer
}

/** Non-React setter. */
export function setActiveContainer(container: Container): void {
  useActiveContainerStore.getState().setActiveContainer(container)
}
