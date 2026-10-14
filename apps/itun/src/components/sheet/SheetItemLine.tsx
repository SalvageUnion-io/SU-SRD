/**
 * SheetItemLine — one installed or carried item on a sheet: its TOKEN (which
 * Peeks the whole card), then its controls ON the same line (owner's call,
 * 2026-10-14: "consistency is the key"). Every control is the sheet control's
 * height (`.su-sheet-ctl`, `styles/sheet/items.css`): 32px from `sm`, the
 * 44px tap floor on a phone, where the controls take the line under the Token.
 *
 *   - the condition: one control naming its state, which steps it on
 *     (Intact → Damaged → Destroyed); Read stamps it only when not intact;
 *   - Uses `[− USES 3/5 +]`, when the item has uses;
 *   - `actions`: the caller's own (a mech item's Repair, an equipment's
 *     Details), each at the same height;
 *   - Remove: a square ✕.
 *
 * A mech's Systems and Modules (`MechItemToken`), a pilot's equipment
 * (`PilotEquipmentItem`) and a pilot's abilities (`PilotAbilityItem`, which
 * has no condition: its Read stamp is "Used") all draw it, so the sheets
 * share one control.
 */

import type { ItemCondition } from 'itun-domain/schemas/itemCondition'
import type { ReactNode } from 'react'

/** The condition's name on its control. */
const CONDITION_LABEL: Record<ItemCondition, string> = {
  intact: 'Intact',
  damaged: 'Damaged',
  destroyed: 'Destroyed',
}

type SheetItemLineProps = {
  /** The item's Token. */
  token: ReactNode
  /** The item's name, for the controls' accessible labels. */
  name: string
  /** The item's condition; absent for a reference with none (an ability). */
  condition?: ItemCondition
  readOnly: boolean
  /** Step the condition on (Intact → Damaged → Destroyed). */
  onConditionCycle?: () => void
  /** Read: a stamp after the Token (an ability's "Used"), beside any condition. */
  stamp?: string
  /** Uses left out of a max; absent when the item has none. */
  uses?: { remaining: number; max: number; onChange: (next: number) => void }
  /** The caller's own controls, after Uses and before Remove. */
  actions?: ReactNode
  /** Remove (✕); omitted where the item cannot be removed here. */
  onRemove?: () => void
}

export function SheetItemLine({
  token,
  name,
  condition,
  readOnly,
  onConditionCycle,
  stamp,
  uses,
  actions,
  onRemove,
}: SheetItemLineProps) {
  const conditionLabel = condition && CONDITION_LABEL[condition]
  // Read: the Token alone while intact; a damaged or destroyed one names its
  // condition as a read-out stamp after it, as does any `stamp`.
  if (readOnly) {
    const damaged = condition !== undefined && condition !== 'intact'
    if (!damaged && !stamp) return token
    return (
      <div className="su-entity-token-line su-sheet-item">
        {token}
        {damaged && (
          <span
            className="su-sheet-ctl su-sheet-ctl--condition su-sheet-ctl--readout"
            data-state={condition}
            title={`${name}: ${conditionLabel}`}
          >
            {conditionLabel}
          </span>
        )}
        {stamp && <span className="su-sheet-ctl su-sheet-ctl--readout">{stamp}</span>}
      </div>
    )
  }

  return (
    <div className="su-entity-token-line su-sheet-item">
      {token}
      {condition && (
        <button
          type="button"
          className="su-sheet-ctl su-sheet-ctl--condition"
          data-state={condition}
          aria-label={`${name} status: ${conditionLabel} — click to change`}
          onClick={onConditionCycle}
        >
          {conditionLabel}
        </button>
      )}
      {uses && uses.max > 0 && (
        <span className="su-sheet-ctl su-sheet-ctl--uses">
          <button
            type="button"
            className="su-sheet-ctl__step"
            aria-label={`Remove one ${name}`}
            disabled={uses.remaining <= 0}
            onClick={() => uses.onChange(uses.remaining - 1)}
          >
            −
          </button>
          <span aria-hidden="true" className="su-sheet-ctl__readout">
            {`Uses ${uses.remaining}/${uses.max}`}
          </span>
          <span role="status" aria-live="polite" className="su-sr-only">
            {name} uses: {uses.remaining}
          </span>
          <button
            type="button"
            className="su-sheet-ctl__step"
            aria-label={`Add one ${name}`}
            disabled={uses.remaining >= uses.max}
            onClick={() => uses.onChange(uses.remaining + 1)}
          >
            +
          </button>
        </span>
      )}
      {actions}
      {onRemove && (
        <button
          type="button"
          className="su-sheet-ctl su-sheet-ctl--square"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          ✕
        </button>
      )}
    </div>
  )
}
