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

export function useHydrateEntities(
  types: readonly EntityType[],
  options?: UseHydrateEntitiesOptions
): boolean {
  const [hydratedAll, setHydratedAll] = useState(false)

  useEffect(() => {
    const run = async () => {
      const store = useEntityStore.getState()
      await Promise.all([
        ...types.map((type) => store.hydrate(type)),
        ...(options?.workspaces ? [useWorkspaceStore.getState().hydrate()] : []),
      ])
      setHydratedAll(true)
    }
    void run()
    // Only run once on mount; stores are stable (Zustand singletons) and the
    // requested types are fixed for a page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return hydratedAll
}
