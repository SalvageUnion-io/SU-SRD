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
export function useHydrateOnMount(hydrate: () => Promise<unknown>): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    void hydrate().then(() => setHydrated(true))
    // Only run once on mount; hydrators close over stable Zustand singletons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return hydrated
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
