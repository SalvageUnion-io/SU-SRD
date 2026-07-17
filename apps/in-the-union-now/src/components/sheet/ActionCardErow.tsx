/**
 * ActionCardErow — a chassis-ability action as an Erow'd card (design §4.3
 * 'Chassis Ability' slab, plan 4.5).
 *
 * ActionCard does not accept footActions/footMeta (it is not an entity
 * card), so the action economy renders in Erow's 'rail' callout instead of
 * the card foot — same vocabulary, no markup surgery.
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
