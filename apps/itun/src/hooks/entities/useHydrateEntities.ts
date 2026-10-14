/**
 * useHydrateEntities — the shared "hydrate everything on mount, then flip a
 * flag" pattern, extracted from Dashboard.
 *
 * Hydrates the given entity types once on mount and returns false until ALL
 * of them have resolved — the exact Promise.all + local-state behavior the
 * pages used inline, so skeletons keep their existing timing.
 */

import { useEffect, useState } from 'react'
import type { EntityType } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'

/**
 * "No error yet" sentinel. A plain `null`/`undefined` can't be used: a hydrator
 * that rejected with `null` or `undefined` would then be indistinguishable from
 * the initial state and NOT re-thrown — silently reproducing the stuck-skeleton
 * bug this hook exists to prevent. A unique symbol can never collide with a
 * real rejection reason.
 */
const NO_ERROR = Symbol('useHydrateOnMount.noError')

/**
 * useHydrateOnMount — the generalization for stores outside entityStore
 * (e.g. the encounter tray's injectable store): run the given hydrator once
 * on mount and flip to true when it resolves. The hydrator is captured on
 * first render only, matching the entity variant's once-on-mount semantics.
 */
export function useHydrateOnMount(hydrate: () => Promise<unknown>): boolean {
  const [state, setState] = useState<{ hydrated: boolean; error: unknown }>({
    hydrated: false,
    error: NO_ERROR,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally once-on-mount — callers pass inline closures over stable Zustand singletons, so depending on `hydrate` would re-run the effect every render
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
  }, [])

  // A rejected hydration must surface as the nearest error boundary's recovery
  // screen — NEVER an infinite loading skeleton. Re-throwing during render
  // hands the error to the nearest router errorComponent.
  if (state.error !== NO_ERROR) throw state.error

  return state.hydrated
}

export function useHydrateEntities(types: readonly EntityType[]): boolean {
  return useHydrateOnMount(() => {
    const store = useEntityStore.getState()
    return Promise.all(types.map((type) => store.hydrate(type)))
  })
}
