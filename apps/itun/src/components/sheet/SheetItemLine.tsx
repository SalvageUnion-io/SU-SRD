/**
 * SheetItemLine — one installed or carried item on a sheet: its TOKEN (which
 * Peeks the whole card), then its controls ON the same line (owner's call,
 * 2026-10-14: "consistency is the key"). Every control is the sheet control's
 * height (`.su-sheet-ctl`, `styles/sheet/items.css`): 32px from `sm`, the
 * 44px tap floor on a phone, where the controls take the line under the Token.
 *
 *   - the condition: the tri-state `StatusBadge`, which steps it on
 *     (Intact → Damaged → Destroyed); Read shows it only when not intact;
 *   - Uses: the horizontal `Stat` in edit mode, `[USES | 3/5] − +`, when the
 *     item has uses;
 *   - `actions`: the caller's own (a mech item's Repair, an equipment's
 *     Details), each at the same height;
 *   - Remove: a square ✕.
 *
 * A mech's Systems and Modules (`MechItemToken`), a pilot's equipment
 * (`PilotEquipmentItem`) and a pilot's abilities (`PilotAbilityItem`, which
 * has no condition: its Read stamp is "Used") all draw it, so the sheets
 * share one control.
 */

import { Stat, StatusBadge } from 'component-lib'
import type { ItemCondition } from 'itun-domain/schemas/itemCondition'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type SheetItemLineProps = {
  /** The item's Token, or a Row (`rowForm`). */
  token: ReactNode
  /** The item is a Row (an ability on its tree's track): the controls take the line under it. */
  rowForm?: boolean
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
  rowForm = false,
}: SheetItemLineProps) {
  const lineClass = rowForm
    ? 'su-entity-token-line su-sheet-item su-sheet-item--row'
    : 'su-entity-token-line su-sheet-item'
  // Read: the Token alone while intact; a damaged or destroyed one names its
  // condition as a read-out stamp after it, as does any `stamp`.
  if (readOnly) {
    const damaged = condition !== undefined && condition !== 'intact'
    if (!damaged && !stamp) return token
    return (
      <div className={lineClass}>
        {token}
        {damaged && <StatusBadge status={condition} />}
        {stamp && <span className="su-sheet-ctl su-sheet-ctl--readout">{stamp}</span>}
      </div>
    )
  }

  return (
    <div className={lineClass}>
      {token}
      {condition && (
        // The one-height rule rides the wrapper (`.su-sheet-item__condition`).
        <span className="su-sheet-item__condition">
          <StatusBadge status={condition} subject={name} onClick={onConditionCycle} />
        </span>
      )}
      {uses && uses.max > 0 && (
        <>
          <Stat
            orientation="horizontal"
            label="Uses"
            value={uses.remaining}
            max={uses.max}
            mode="edit"
            onChange={uses.onChange}
            stepperLabel={`${name} uses`}
            className="su-sheet-item__uses"
          />
          <span role="status" aria-live="polite" className="su-sr-only">
            {name} uses: {uses.remaining}
          </span>
        </>
      )}
      {actions}
      {onRemove && (
        <button
          type="button"
          className="su-sheet-ctl su-sheet-ctl--square"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <X aria-hidden="true" size={14} />
        </button>
      )}
    </div>
  )
}
