/**
 * useEquipmentLoadout — controlled adapter between a pilot's persisted
 * per-equipment installed loadout (`pilot.equipmentLoadouts[slug]`) and the
 * "Add System / Add Module" collection UI (the same EntitySearcher + section
 * stack mechs use).
 *
 * Given the owning pilot + a drone-equipment slug + the persisted seed loadout
 * (sourced from the canonical pilot prop, so read-only/snapshot rendering does
 * not depend on the live store), it returns the current loadout plus add/remove
 * handlers. Adds emit the entity NAME (EntitySearcher's default idOf), which we
 * kebab-slugify to match the system/module slug convention.
 *
 * Write path reads the FRESHEST record from the store at call time (not a
 * render-time closure) and merges only this slug's entry, mirroring
 * useEntityChoices.setSelections and MechSheet.addItem/removeItem so rapid edits
 * to sibling equipment never clobber each other. Dep-injected `store` keeps the
 * hook unit-testable without module mocking.
 */

import { useCallback } from 'react'

import { nameToSlug } from 'salvageunion-reference'

import { useEntityStore } from '../../stores/entityStore'
import type { Pilot } from '../../lib/schemas/pilot'

/** One equipment instance's installed loadout. */
export type EquipmentLoadout = { systems: string[]; modules: string[] }

/** Stable empty loadout — frozen so a fresh literal never defeats memoisation. */
const EMPTY_LOADOUT: EquipmentLoadout = Object.freeze({
  systems: Object.freeze([]) as unknown as string[],
  modules: Object.freeze([]) as unknown as string[],
})

type UseEquipmentLoadoutResult = {
  loadout: EquipmentLoadout
  addSystem: (name: string) => void
  removeSystem: (index: number) => void
  addModule: (name: string) => void
  removeModule: (index: number) => void
}

export function useEquipmentLoadout(
  pilotId: string,
  slug: string,
  /** Persisted loadout for this equipment, from the canonical pilot prop. */
  seed: EquipmentLoadout | undefined,
  /** Injectable store — defaults to useEntityStore. Pass a stub in tests. */
  store: typeof useEntityStore = useEntityStore
): UseEquipmentLoadoutResult {
  const storeState = store()

  const loadout: EquipmentLoadout = seed ?? EMPTY_LOADOUT

  /** Merge this slug's next loadout into the freshest pilot record. */
  const write = useCallback(
    (next: EquipmentLoadout) => {
      const fresh = storeState.get('pilot', pilotId) as Pilot | undefined
      const prevAll = fresh?.equipmentLoadouts ?? {}
      void storeState.update('pilot', pilotId, {
        equipmentLoadouts: { ...prevAll, [slug]: next },
      })
    },
    [storeState, pilotId, slug]
  )

  const current = useCallback((): EquipmentLoadout => {
    const fresh = storeState.get('pilot', pilotId) as Pilot | undefined
    const entry = fresh?.equipmentLoadouts?.[slug]
    return { systems: entry?.systems ?? [], modules: entry?.modules ?? [] }
  }, [storeState, pilotId, slug])

  const addSystem = useCallback(
    (name: string) => {
      const c = current()
      write({ ...c, systems: [...c.systems, nameToSlug(name)] })
    },
    [current, write]
  )
  const removeSystem = useCallback(
    (index: number) => {
      const c = current()
      write({ ...c, systems: c.systems.filter((_, i) => i !== index) })
    },
    [current, write]
  )
  const addModule = useCallback(
    (name: string) => {
      const c = current()
      write({ ...c, modules: [...c.modules, nameToSlug(name)] })
    },
    [current, write]
  )
  const removeModule = useCallback(
    (index: number) => {
      const c = current()
      write({ ...c, modules: c.modules.filter((_, i) => i !== index) })
    },
    [current, write]
  )

  return { loadout, addSystem, removeSystem, addModule, removeModule }
}
