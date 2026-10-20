/**
 * MiniGroup — an entity's contentful Mini and the Minis that belong to it,
 * held in ONE border in that entity's tone (owner's call, 2026-10-20): a
 * crawler bay, then its crew lead, what it holds and its When Damaged. It is
 * no nesting: the Minis sit side by side in the group, none inside another
 * (a Mini nests nothing, E6), and the border is no frame (no head, no
 * level). It only says they are one thing's.
 *
 * Its tone is the entity's Mini's own (`paintFor`), dulled as the Mini is
 * when the entity is down.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { downOf } from '../../referenceEntity/card/cardChrome'
import { paintFor } from '../parts/paint'

export function MiniGroup({
  entity,
  condition,
  label,
  children,
}: {
  /** The entity whose tone the border wears: the group's first Mini's. */
  entity: RefMetaEntity
  /** Its condition, so a damaged one's border dulls as its Mini does. */
  condition?: string
  /** The group's accessible name ("Mech Bay"). */
  label: string
  children: ReactNode
}) {
  const paint = paintFor(toEntityModel(entity).tone, {
    down: downOf(condition),
    texture: false,
  })
  const style = { borderColor: paint.background } satisfies CSSProperties
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group, not a landmark; a <section> named here would add a region per bay
    <div role="group" aria-label={label} className="su-mini-group" style={style}>
      {children}
    </div>
  )
}
