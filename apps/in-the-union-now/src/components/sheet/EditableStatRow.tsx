/**
 * EditableStatRow — composes InlineEditField with useSoftWarnings + SoftWarningBanner.
 *
 * Renders a stat label alongside an editable value. On save:
 *   1. Persists via entityStore.update.
 *   2. Previews the patch through useSoftWarnings (advisory, non-blocking).
 *   3. If warnings result, shows SoftWarningBanner with "Save anyway" / "Fix it".
 *      "Save anyway" re-persists via saveAnyway(); "Fix it" discards the warning.
 *
 * Live-play steppers (Slice D): when `step` is provided, +/- buttons render
 * alongside the click-to-edit value. They apply a clamped delta (value ± step,
 * floored at `min` and capped at `max`) and persist via the same store path —
 * so a player can quickly subtract damage / spend without retyping, while the
 * absolute click-to-edit affordance remains. Steppers respect readOnly (hidden)
 * and disable when a further step would leave the current value unchanged.
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
  /**
   * When provided (and not readOnly), renders - / + stepper buttons that apply a
   * clamped delta of this size. Omit to render the bare click-to-edit value with
   * no steppers (the pre-Slice-D behaviour). Must be a positive number.
   */
  step?: number
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
  step,
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

  // Apply a clamped delta relative to the freshest CURRENT value (floored at
  // `min`, capped at `max`). Reads from the store first — not the render-time
  // `value` prop — so rapid +/- clicks don't stomp each other with a
  // stale-closure overwrite (store.update is async write-through). Mirrors
  // PilotSheet.handleSpendAP. Reuses handleSave so the persist + soft-warning
  // preview path is identical to the absolute edit.
  async function applyDelta(delta: number) {
    const fresh = storeState.get(entityKind, entityId)
    const current = ((fresh?.[fieldPath] as number | undefined) ?? value) as number
    let next = current + delta
    if (min !== undefined && next < min) next = min
    if (max !== undefined && next > max) next = max
    if (next === current) return
    await handleSave(next)
  }

  const showSteppers = !readOnly && step !== undefined && step > 0
  const atMin = min !== undefined && value <= min
  const atMax = max !== undefined && value >= max

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-su-ink-soft">
          {label}
        </span>
        {showSteppers && (
          <button
            type="button"
            aria-label={`Decrease ${label} by ${step}`}
            disabled={atMin}
            onClick={() => {
              void applyDelta(-(step as number))
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper font-mono text-base font-bold text-su-black hover:bg-su-black hover:text-su-paper focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-su-paper disabled:hover:text-su-black"
          >
            −
          </button>
        )}
        <InlineEditField
          value={value}
          onSave={handleSave}
          type="number"
          min={min}
          max={max}
          ariaLabel={`Edit ${label}`}
          readOnly={readOnly}
        />
        {showSteppers && (
          <button
            type="button"
            aria-label={`Increase ${label} by ${step}`}
            disabled={atMax}
            onClick={() => {
              void applyDelta(step as number)
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded border-[1.5px] border-su-black bg-su-paper font-mono text-base font-bold text-su-black hover:bg-su-black hover:text-su-paper focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-su-paper disabled:hover:text-su-black"
          >
            +
          </button>
        )}
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
