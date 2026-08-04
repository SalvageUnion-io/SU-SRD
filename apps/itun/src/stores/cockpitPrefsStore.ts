/**
 * cockpitPrefsStore — persisted Dashboard dial preferences, keyed by container.
 *
 * These used to live on the Workspace record, which is where they got both
 * their persistence and their scope. Workspaces are gone (ADR-030 §2), and the
 * two containers that replace them are wrong homes for this: a Game is shared
 * server state, and dial layout is a personal display preference nobody else
 * at the table should inherit; the Shelf is not a record at all.
 *
 * So prefs move to localStorage, still scoped per container so a player who
 * runs two Games keeps a layout for each. That is a deliberate narrowing —
 * prefs no longer travel in an export bundle, because they never described the
 * build, only how one browser chose to look at it.
 */

import { create } from 'zustand'
import type { Container } from '../lib/container'
import type { CockpitPrefs } from '../lib/schemas/cockpitPrefs'
import { CockpitPrefsSchema } from '../lib/schemas/cockpitPrefs'
import { serializeContainer } from './activeContainerStore'

const STORAGE_KEY = 'itun.cockpitPrefs'

type PrefsByContainer = Record<string, CockpitPrefs>

/**
 * Read the whole map, discarding anything that no longer parses.
 *
 * Per-entry rather than all-or-nothing: a prefs shape that changed shape in a
 * later build should cost the user that one layout, not every layout they have.
 */
function readPersisted(): PrefsByContainer {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}

    const out: PrefsByContainer = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const result = CockpitPrefsSchema.safeParse(value)
      if (result.success) out[key] = result.data
    }
    return out
  } catch {
    return {}
  }
}

function writePersisted(prefs: PrefsByContainer): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // best-effort — a private-mode localStorage throw must not break the dial
  }
}

type CockpitPrefsState = {
  byContainer: PrefsByContainer
  set: (container: Container, prefs: CockpitPrefs) => void
}

export const useCockpitPrefsStore = create<CockpitPrefsState>((set, get) => ({
  byContainer: readPersisted(),
  set(container, prefs) {
    const next = { ...get().byContainer, [serializeContainer(container)]: prefs }
    writePersisted(next)
    set({ byContainer: next })
  },
}))

/** Reactive read of one container's prefs; undefined when never configured. */
export function useCockpitPrefs(container: Container): CockpitPrefs | undefined {
  return useCockpitPrefsStore((s) => s.byContainer[serializeContainer(container)])
}

/** Non-React setter. */
export function setCockpitPrefs(container: Container, prefs: CockpitPrefs): void {
  useCockpitPrefsStore.getState().set(container, prefs)
}
