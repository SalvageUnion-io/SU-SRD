/**
 * Query hooks over entityStore (design review T-7).
 *
 * Centralizes the reactive read layer: components subscribe through these
 * typed hooks instead of ad-hoc `useEntityStore((s) => …)` selectors. Each
 * hook mirrors the store's lazy auto-hydration semantics — reading a type
 * that has never been hydrated fires `hydrate(type)` exactly like
 * `entityStore.list()` does — so hook consumers never see stale-empty data
 * that would only appear after some *other* component happened to hydrate.
 *
 * Selector-equality notes (Zustand v5 uses Object.is on the selected value):
 *   - List hooks select the store's array reference directly — stable until a
 *     write to that type.
 *   - By-id hooks select via `.find()` — entity object references are stable
 *     across unrelated writes because `update()` maps the array and reuses
 *     untouched elements. No `useShallow` needed for either shape.
 *
 * Imperative reads inside event handlers should keep using
 * `useEntityStore.getState()` (legitimate — no subscription needed).
 */

import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'
import { useEntityStore } from '../../stores/entityStore'
import type { EntityType } from '../../stores/entityStore'
import type { EntityForType } from '../../stores/types'

/** Full entityStore state+actions shape (what selectors receive). */
type EntityStoreState = ReturnType<typeof useEntityStore.getState>

type ListKey = 'pilots' | 'mechs' | 'crawlers' | 'softLinks'

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

/** The record of `type` with `id`, or null (null when id is undefined). */
function selectEntityById<T extends EntityType>(
  state: EntityStoreState,
  type: T,
  id: string | undefined
): EntityForType<T> | null {
  if (!id) return null
  return selectEntityList(state, type).find((e) => e.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Lazy-hydration trigger — mirrors entityStore.list()'s fire-and-forget
// `void hydrate(type)` so hooks behave exactly like the store's own read API.
// ---------------------------------------------------------------------------

function ensureHydrated(type: EntityType): void {
  const state = useEntityStore.getState()
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
  return useEntityStore((s) => selectEntityList(s, type))
}

/**
 * Reactive by-id read. Returns null while unhydrated, when the record does
 * not exist, or when `id` is undefined. Auto-triggers lazy hydration.
 */
export function useEntity<T extends EntityType>(
  type: T,
  id: string | undefined
): EntityForType<T> | null {
  ensureHydrated(type)
  return useEntityStore((s) => selectEntityById(s, type, id))
}

// ---------------------------------------------------------------------------
// Named per-type hooks
// ---------------------------------------------------------------------------

export function usePilots(): Pilot[] {
  return useEntityList('pilot')
}

export function usePilot(id: string | undefined): Pilot | null {
  return useEntity('pilot', id)
}

export function useMechs(): Mech[] {
  return useEntityList('mech')
}

export function useMech(id: string | undefined): Mech | null {
  return useEntity('mech', id)
}

export function useCrawlers(): Crawler[] {
  return useEntityList('crawler')
}

/**
 * Reactive list of ALL SoftLink records. Named `useSoftLinkList` (not
 * `useSoftLinks`) to avoid colliding with the domain-level
 * `components/wiring/useSoftLinks` hook, which filters these into
 * incoming/outgoing for one entity.
 */
export function useSoftLinkList(): SoftLink[] {
  return useEntityList('softLink')
}
