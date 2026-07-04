/**
 * useEntityChoices — controlled-selection adapter between an entity's persisted
 * per-item choice map and suref-react's ReferenceEntityDisplay `selections` /
 * `onSelectionChange` props.
 *
 * Given an entity (`entityType`/`entityId`), an item slug, the name of the field
 * that holds the per-item choice map (e.g. 'equipmentChoices'), and a `seed`
 * (the persisted selections for that item, sourced from the canonical loaded
 * entity prop), it returns:
 *   - `selections`: the persisted ChoiceSelections for that one item.
 *   - `setSelections`: persists the next ChoiceSelections for that item without
 *     clobbering sibling items' choices or any other field.
 *
 * Read path (`selections`): sourced from `seed` — the selections passed in by the
 * caller, which it derives from the canonical entity prop (e.g. the snapshot or
 * loaded pilot). This makes read-only/snapshot rendering correct even when the
 * live store has no entity (a viewer of a share link does not own the pilot
 * locally), and avoids async-hydration flashes since it does not re-fetch from
 * the store during render.
 *
 * Write path (`setSelections`): reads the FRESHEST field map from the store at
 * call time (not the render-time prop), mirroring PilotSheet's
 * handleEquipmentConditionChange. This keeps rapid sequential toggles from
 * stomping each other. Its identity tracks `storeState` (it is recreated when the
 * store mutates), consistent with the condition-change handler convention.
 *
 * Dep-injection (store) makes the hook unit-testable without module mocking
 * (NO mock.module() in tests).
 */

import { useCallback } from 'react'

import type { ChoiceSelections } from 'suref-react'

import { useEntityStore } from '../../stores/entityStore'
import type { EntityType, EntityForType } from '../../stores/types'

/**
 * Stable empty-selections reference. ReferenceEntityDisplay is wrapped in
 * React.memo with the default shallow comparator, so returning a fresh `{}`
 * literal on every render would defeat the memo. Frozen so it cannot be mutated.
 */
const EMPTY_SELECTIONS: ChoiceSelections = Object.freeze({})

/** Keys of an entity whose value is a per-item choice map (slug → ChoiceSelections). */
type ChoiceMapField<T extends EntityType> = {
  [K in keyof EntityForType<T>]: EntityForType<T>[K] extends
    Record<string, ChoiceSelections> | undefined
    ? K
    : never
}[keyof EntityForType<T>] &
  string

type UseEntityChoicesResult = {
  /** Persisted selections for this one item (empty object when none). */
  selections: ChoiceSelections
  /** Persist the next selections for this item, merging with siblings. */
  setSelections: (next: ChoiceSelections) => void
}

export function useEntityChoices<T extends EntityType>(
  entityType: T,
  entityId: string,
  itemSlug: string,
  field: ChoiceMapField<T>,
  /**
   * Persisted selections for this item, sourced from the canonical entity prop
   * (e.g. snapshot/loaded pilot). Used directly as the controlled `selections`
   * so read-only/snapshot rendering does not depend on the live store.
   */
  seed: ChoiceSelections | undefined,
  /** Injectable store — defaults to useEntityStore. Pass a stub in tests. */
  store: typeof useEntityStore = useEntityStore
): UseEntityChoicesResult {
  const storeState = store()

  const selections: ChoiceSelections = seed ?? EMPTY_SELECTIONS

  const setSelections = useCallback(
    (next: ChoiceSelections) => {
      // Read the freshest field map from the store (not a render-time closure)
      // so concurrent edits to sibling items aren't clobbered.
      const fresh = storeState.get(entityType, entityId)
      const prevAll = (fresh?.[field] as Record<string, ChoiceSelections> | undefined) ?? {}
      const patch = {
        [field]: { ...prevAll, [itemSlug]: next },
      } as Partial<EntityForType<T>>
      void storeState.update(entityType, entityId, patch)
    },
    [storeState, entityType, entityId, itemSlug, field]
  )

  return { selections, setSelections }
}
