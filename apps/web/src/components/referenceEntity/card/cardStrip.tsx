import type { ReactNode } from 'react'
import type { EntityStatus } from '../../atoms/entityStatus'
import { Stat } from '../../atoms/Stat'
import { StatusBadge } from '../../atoms/StatusBadge'
import { controlChips } from '../../compositions/ControlButtons'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

/**
 * A card's controls and condition as its head's chip-group slots
 * (`chips-and-actions.md` C8, hard rule R6): nothing rides the frame or sits
 * under the strip.
 *
 * - `state`: the condition (`StatusBadge`, ruleset §2.3: a `status` control
 *   steps it; with none, a read card reports any condition but Intact) and a
 *   count's stepper (`Stat` in edit mode, the one stepper).
 * - `controls`: every other visible control, the strip's last slot (`Head`'s
 *   `controls`), each one chip.
 */
export function cardStripSlots({
  controls,
  status,
  subject,
}: {
  controls: readonly ReferenceEntityControl[] | undefined
  status: EntityStatus | undefined
  subject: string
}): { state: ReactNode[]; controls: ReactNode[] } {
  const visible = (controls ?? []).filter((c) => !c.hidden)
  const conditions = visible.filter((c) => c.status)
  const steppers = visible.filter((c) => c.stepper && !c.status)
  const actions = visible.filter((c) => !c.status && !c.stepper)
  // Print reads, pencil writes (ruleset §1.2): Intact is the default, so a
  // read card draws no condition rather than a stamp on every card.
  const read =
    conditions.length === 0 && status && status !== 'intact'
      ? [<StatusBadge key="condition" status={status} subject={subject} />]
      : []
  const state = [
    ...read,
    ...controlChips(conditions),
    ...steppers.map(({ key, stepper }) =>
      stepper ? (
        <Stat
          key={key}
          label={stepper.label}
          value={stepper.value}
          max={stepper.max}
          ceiling={stepper.ceiling}
          size="mini"
          mode="edit"
          onChange={stepper.onChange}
          stepperLabel={stepper.subject}
        />
      ) : null
    ),
  ]
  return { state, controls: controlChips(actions) }
}
