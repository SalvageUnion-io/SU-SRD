/**
 * activeContainerStore — the app's single "current container" (ADR-030 §2).
 *
 * An entity lives in exactly one of two places, a shared **Game** or the owner's personal
 * **Shelf**, and this store holds whichever of those the user is currently
 * looking at.
 *
 * ## It only means anything in Connected mode
 *
 * A Solo user has no Games — there is no account, so there is nothing to share
 * with, and signed out every store reads empty. This store still resolves (to
 * the Shelf) in Solo so callers need no branch, but nothing consults it there.
 *
 * ## Persistence
 *
 * Serialized as a single string — `shelf`, or `game:<id>` — because the pair
 * (kind, id) is one decision and two keys could contradict each other. The
 * value survives reloads and navigation.
 */

import { create } from 'zustand'
import type { Container } from '../lib/container'
import { SHELF } from '../lib/container'
import { readLocal, writeLocal } from '../lib/safeLocalStorage'

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
  // `readLocal` already answers "no storage" and "storage threw" with null,
  // which `parseContainer` reads as the Shelf — the same fallback the old
  // hand-rolled guard produced.
  return parseContainer(readLocal(STORAGE_KEY))
}

function writePersisted(container: Container): void {
  // Best-effort by contract: a private-mode refusal must not break selection.
  writeLocal(STORAGE_KEY, serializeContainer(container))
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
