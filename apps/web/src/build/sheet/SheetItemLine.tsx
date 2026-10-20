/**
 * SheetItemLine — one installed or carried item on a sheet: its TOKEN (which
 * Peeks the whole card), its state, uses and actions in the Mini's own chip
 * group, after the cost, in the fixed slots (`chips-and-actions.md` C8, hard
 * rules R6 and R11): state · uses · the actions and ✕, at the Mini's Size
 * (Mini; a Compact's Compact). Nothing sits beside the strip or under it.
 *
 *   - the condition: the tri-state `StatusBadge`, which steps it on
 *     (Intact → Damaged → Destroyed); Read shows it only when not intact;
 *   - Uses: the horizontal `Stat` in edit mode, `[USES | 3/5] − +`, when the
 *     item has uses;
 *   - `actions`: the caller's own (a mech item's Repair, an ability's Spend
 *     AP and Used, an equipment's Details, which opens its Page);
 *   - Remove: a square ✕ (`SheetRemoveButton`, the sheet's one remove control).
 *
 * A mech's Systems and Modules (`MechItemMini`), a pilot's equipment
 * (`PilotEquipmentItem`), a pilot's abilities (`PilotAbilityItem`, which has
 * no condition: its Read stamp is "Used") and an item the reference does not
 * know (`UnknownItemLine`), a pilot's generic entry (`GenericEntryLine`) and a
 * cargo lot (`CargoLotLine`) all draw it, so the sheets share one control. The
 * token is an `<Entity>` element: its `state` (after any it brings, a
 * quantity), `uses` and `controls` are filled here.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { cloneElement } from 'react'
import type { EntityProps } from '../../components/entity/Entity'
import { Badge, Button, Stat, StatusBadge, tokens } from '../../components/index'

type SheetItemLineProps = {
  /** The item's Mini, or a Compact (an ability on its tree's track): an `<Entity>` element. */
  token: ReactElement<EntityProps>
  /** The item's name, for the controls' accessible labels. */
  name: string
  /** The item's condition; absent for a reference with none (an ability). */
  condition?: ItemCondition
  readOnly: boolean
  /** Step the condition on (Intact → Damaged → Destroyed). */
  onConditionCycle?: () => void
  /** The condition a step goes to, where it is not the next of three (a crawler bay: Intact ↔ Damaged). */
  nextCondition?: ItemCondition
  /** Read: a stamp in the state slot (an ability's "Used"), beside any condition. */
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
  nextCondition,
  stamp,
  uses,
  actions,
  onRemove,
}: SheetItemLineProps) {
  // Mini, a chip's height, on a Mini and on a Compact's head alike (C1a).
  const size = 'mini'
  const stampChip = stamp && (
    <Badge key="stamp" shape="stamp" surface="inverse" size={size}>
      {stamp}
    </Badge>
  )
  // Read: the Mini alone while intact; a damaged or destroyed one names its
  // condition in its state slot, as does any `stamp`.
  // The token's own state (a carried entry's quantity) leads the slot.
  const own = token.props.state
  if (readOnly) {
    const damaged = condition !== undefined && condition !== 'intact'
    if (!damaged && !stamp) return token
    return cloneElement(token, {
      state: (
        <>
          {own}
          {damaged && (
            <span className="su-sheet-item__condition">
              <StatusBadge status={condition} />
            </span>
          )}
          {stampChip}
        </>
      ),
    })
  }

  const hasUses = uses !== undefined && uses.max > 0
  const item = cloneElement(token, {
    state:
      condition || stampChip || own ? (
        <>
          {own}
          {condition ? (
            <span className="su-sheet-item__condition">
              <StatusBadge
                status={condition}
                subject={name}
                onClick={onConditionCycle}
                {...(nextCondition ? { next: nextCondition } : {})}
              />
            </span>
          ) : (
            stampChip
          )}
        </>
      ) : undefined,
    ...(hasUses
      ? {
          uses: (
            <Stat
              label="Uses"
              value={uses.remaining}
              max={uses.max}
              size={size}
              mode="edit"
              onChange={uses.onChange}
              stepperLabel={`${name} uses`}
              className="su-sheet-item__uses"
            />
          ),
        }
      : {}),
    // Always given in Edit: a Mini with controls is the one whose name is
    // the link, so its condition's button never sits inside one.
    controls: (
      <>
        {actions}
        {onRemove && <SheetRemoveButton name={name} onRemove={onRemove} />}
      </>
    ),
  })
  if (!hasUses) return item
  return (
    <>
      {item}
      <span role="status" aria-live="polite" className="su-sr-only">
        {name} uses: {uses.remaining}
      </span>
    </>
  )
}

/**
 * The Live Sheet's one remove control (hard rule R11): a square ✕ in its
 * item's chip group, at the strip's Size, named "Remove <name>". Every sheet
 * item, unknown item, inventory entry and mounted weapon removes through it,
 * Edit only.
 */
function SheetRemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Button
      variant="pencil"
      size="mini"
      className="su-sheet-item__remove"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
    >
      <X aria-hidden="true" size={tokens.iconSize.mini} />
    </Button>
  )
}
