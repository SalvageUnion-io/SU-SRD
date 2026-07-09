/**
 * useHydrateEntities — the shared "hydrate everything on mount, then flip a
 * flag" pattern (design review T-7), extracted from Dashboard.
 *
 * Hydrates the given entity types (plus, optionally, workspaces) once on
 * mount and returns false until ALL of them have resolved — the exact
 * Promise.all + local-state behavior the pages used inline, so skeletons
 * keep their existing timing.
 */

import { useEffect, useState } from 'react'

import { useEntityStore } from '../../stores/entityStore'
import type { EntityType } from '../../stores/entityStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

type UseHydrateEntitiesOptions = {
  /** Also hydrate workspaceStore alongside the entity types. */
  workspaces?: boolean
}

/**
 * useHydrateOnMount — the generalization for stores outside entityStore
 * (e.g. the encounter tray's injectable store): run the given hydrator once
 * on mount and flip to true when it resolves. The hydrator is captured on
 * first render only, matching the entity variant's once-on-mount semantics.
 */
/**
 * "No error yet" sentinel. A plain `null`/`undefined` can't be used: a hydrator
 * that rejected with `null` or `undefined` would then be indistinguishable from
 * the initial state and NOT re-thrown — silently reproducing the stuck-skeleton
 * bug this hook exists to prevent. A unique symbol can never collide with a
 * real rejection reason.
 */
const NO_ERROR = Symbol('useHydrateOnMount.noError')

export function useHydrateOnMount(hydrate: () => Promise<unknown>): boolean {
  const [state, setState] = useState<{ hydrated: boolean; error: unknown }>({
    hydrated: false,
    error: NO_ERROR,
  })

  useEffect(() => {
    let cancelled = false
    hydrate().then(
      () => {
        if (!cancelled) setState({ hydrated: true, error: NO_ERROR })
      },
      (err: unknown) => {
        if (!cancelled) setState({ hydrated: false, error: err })
      }
    )
    return () => {
      cancelled = true
    }
    // Only run once on mount; hydrators close over stable Zustand singletons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A rejected hydration (e.g. a blocked or otherwise failed IndexedDB open)
  // must surface as the root error boundary's recovery screen — NEVER an
  // infinite loading skeleton. Re-throwing during render hands the error to the
  // nearest router errorComponent (RootErrorComponent). See lib/db/index.ts's
  // BlockedUpgradeError for the canonical case this guards against.
  if (state.error !== NO_ERROR) throw state.error

  return state.hydrated
}

export function useHydrateEntities(
  types: readonly EntityType[],
  options?: UseHydrateEntitiesOptions
): boolean {
  return useHydrateOnMount(() => {
    const store = useEntityStore.getState()
    return Promise.all([
      ...types.map((type) => store.hydrate(type)),
      ...(options?.workspaces ? [useWorkspaceStore.getState().hydrate()] : []),
    ])
  })
}
