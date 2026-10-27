import type { UnitsState } from '../../replica/units'
/**
 * Query hooks over entityStore.
 *
 * Centralizes the reactive read layer: components subscribe through these
 * typed hooks instead of ad-hoc `useUnits((s) => …)` selectors. Each
 * hook mirrors the store's lazy auto-hydration semantics — reading a type
 * that has never been hydrated fires `hydrate(type)` exactly like
 * `entityStore.list()` does — so hook consumers never see stale-empty data
 * that would only appear after some *other* component happened to hydrate.
 *
 * Selector-equality notes (Zustand v5 uses Object.is on the selected value):
 *   - List hooks select the store's array reference directly — stable until a
 *     write to that type. No `useShallow` needed.
 *
 * Imperative reads inside event handlers should keep using
 * `useUnits.getState()` (legitimate — no subscription needed).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Npc } from 'game-domain/schemas/npc'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import type { EntityForType } from '../../replica/types'
import type { EntityType } from '../../replica/units'
import { useUnits } from '../../replica/units'

/** Full entityStore state+actions shape (what selectors receive). */
type EntityStoreState = UnitsState

type ListKey = 'pilots' | 'mechs' | 'crawlers' | 'npcs' | 'softLinks'

function listKeyFor(type: EntityType): ListKey {
  return `${type}s`
}

// ---------------------------------------------------------------------------
// Selector functions — shared by the reactive hooks below.
// ---------------------------------------------------------------------------

/** All records of `type` from in-memory state (the store's array reference). */
function selectEntityList<T extends EntityType>(
  state: EntityStoreState,
  type: T
): EntityForType<T>[] {
  // Same correlated-union assertion the store itself uses in list().
  return state[listKeyFor(type)] as EntityForType<T>[]
}

// ---------------------------------------------------------------------------
// Lazy-hydration trigger — mirrors entityStore.list()'s fire-and-forget
// `void hydrate(type)` so hooks behave exactly like the store's own read API.
// ---------------------------------------------------------------------------

function ensureHydrated(type: EntityType): void {
  const state = useUnits.getState()
  if (!state.hydrated[listKeyFor(type)]) {
    // Fire-and-forget — idempotent; callers needing a synchronous result
    // should await hydrate() in a route loader first (existing pattern).
    void state.hydrate(type)
  }
}

// ---------------------------------------------------------------------------
// Generic hooks
// ---------------------------------------------------------------------------

/** Reactive list of all records of `type`. Auto-triggers lazy hydration. */
function useEntityList<T extends EntityType>(type: T): EntityForType<T>[] {
  ensureHydrated(type)
  return useUnits((s) => selectEntityList(s, type))
}

// ---------------------------------------------------------------------------
// Named per-type hooks
// ---------------------------------------------------------------------------

export function usePilots(): Pilot[] {
  return useEntityList('pilot')
}

export function useMechs(): Mech[] {
  return useEntityList('mech')
}

export function useCrawlers(): Crawler[] {
  return useEntityList('crawler')
}

export function useNpcs(): Npc[] {
  return useEntityList('npc')
}

/**
 * Reactive list of ALL SoftLink records. Named `useSoftLinkList` (not
 * `useSoftLinks`) to avoid colliding with the domain-level
 * `build/wiring/useSoftLinks` hook, which filters these into
 * incoming/outgoing for one entity.
 */
export function useSoftLinkList(): SoftLink[] {
  return useEntityList('softLink')
}
