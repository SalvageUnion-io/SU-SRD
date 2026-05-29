/**
 * EditableStatRow — composes InlineEditField with useSoftWarnings + SoftWarningBanner.
 *
 * Renders a stat label alongside an editable value. On save:
 *   1. Persists via entityStore.update.
 *   2. Previews the patch through useSoftWarnings (advisory, non-blocking).
 *   3. If warnings result, shows SoftWarningBanner with "Save anyway" / "Fix it".
 *      "Save anyway" re-persists via saveAnyway(); "Fix it" discards the warning.
 *
 * Dep-injectable: pass `store` and `evaluate` to override defaults in tests.
 * No mock.module() needed.
 */

import type { evaluateSoftWarnings } from '../../lib/rules/softWarnings'
import { useEntityStore } from '../../stores/entityStore'
import type { AssignableType, EntityForType } from '../../stores/types'
import { SoftWarningBanner } from '../shared/SoftWarningBanner'
import { useSoftWarnings } from '../shared/useSoftWarnings'
import { InlineEditField } from './InlineEditField'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditableStatRowProps<T extends AssignableType> = {
  label: string
  value: number
  entityKind: T
  entityId: string
  /** Key of the numeric field on the entity, e.g. 'currentHP' */
  fieldPath: keyof EntityForType<T> & string
  min?: number
  max?: number
  /** When true, renders value as plain text with no click-to-edit affordance. */
  readOnly?: boolean
  /** Injectable store — defaults to useEntityStore */
  store?: typeof useEntityStore
  /** Injectable evaluator — defaults to evaluateSoftWarnings */
  evaluate?: typeof evaluateSoftWarnings
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditableStatRow<T extends AssignableType>({
  label,
  value,
  entityKind,
  entityId,
  fieldPath,
  min,
  max,
  readOnly = false,
  store = useEntityStore,
  evaluate,
}: EditableStatRowProps<T>) {
  const storeState = store()

  const { warnings, preview, saveAnyway, fixIt } = useSoftWarnings({
    entityType: entityKind,
    entityId,
    evaluate,
    store,
  })

  async function handleSave(next: number | string) {
    const numValue = typeof next === 'string' ? Number(next) : next
    const patch = { [fieldPath]: numValue } as Partial<EntityForType<T>>

    // Persist immediately — soft warnings are advisory, not blocking.
    await storeState.update(entityKind, entityId, patch)

    // Preview the patch so any soft warnings surface in the banner.
    // The banner's "Save anyway" / "Fix it" are informational in this flow
    // (the save has already happened). "Fix it" dismisses the warnings.
    preview(patch)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <InlineEditField
          value={value}
          onSave={handleSave}
          type="number"
          min={min}
          max={max}
          ariaLabel={`Edit ${label}`}
          readOnly={readOnly}
        />
      </div>

      {warnings.length > 0 && (
        <SoftWarningBanner
          warnings={warnings}
          onSaveAnyway={() => {
            void saveAnyway()
          }}
          onFixIt={fixIt}
        />
      )}
    </div>
  )
}
