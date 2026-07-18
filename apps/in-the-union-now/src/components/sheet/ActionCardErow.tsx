/**
 * ActionCardErow — a chassis-ability action as an Erow'd card (design §4.3
 * 'Chassis Ability' slab, plan 4.5).
 *
 * ActionCard is not an entity card (no card foot / controls of its own), so the
 * action economy renders in Erow's 'rail' callout beside it — same vocabulary,
 * no markup surgery.
 */

import type { ReactNode } from 'react'
import type { SURefEntity, SURefMetaAction } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'component-lib'
import type { CardFootMeta } from 'component-lib'

import { Erow } from './Erow'

type ActionCardErowProps = {
  ability: SURefMetaAction
  footMeta?: CardFootMeta[]
  actions?: ReactNode
}

export function ActionCardErow({ ability, footMeta, actions }: ActionCardErowProps) {
  return (
    <Erow mode="rail" footMeta={footMeta} actions={actions}>
      <ReferenceEntityDisplay
        data={ability as unknown as SURefEntity}
        hostTone="var(--color-sheet-mech-deep)"
      />
    </Erow>
  )
}
