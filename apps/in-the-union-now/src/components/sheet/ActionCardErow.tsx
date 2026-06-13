/**
 * ActionCardErow — a chassis-ability action as an Erow'd card (design §4.3
 * 'Chassis Ability' slab, plan 4.5).
 *
 * ActionCard does not accept footActions/footMeta (it is not an entity
 * card), so the action economy renders in Erow's 'rail' callout instead of
 * the card foot — same vocabulary, no markup surgery.
 */

import type { ReactNode } from 'react'
import type { SURefMetaAction } from 'salvageunion-reference'
import { ActionCard } from 'suref-react'
import type { CardFootMeta } from 'suref-react'

import { Erow } from './Erow'

type ActionCardErowProps = {
  ability: SURefMetaAction
  footMeta?: CardFootMeta[]
  actions?: ReactNode
}

export function ActionCardErow({ ability, footMeta, actions }: ActionCardErowProps) {
  return (
    <Erow mode="rail" grow={1.35} footMeta={footMeta} actions={actions}>
      <ActionCard data={ability} parentHeaderBgColor="var(--color-sheet-mech-deep)" />
    </Erow>
  )
}
