/**
 * MiniGroup — an entity's contentful Mini and the Minis that belong to it,
 * held in ONE border: a crawler bay, then its crew
 * lead, what it holds and its When Damaged. It is no nesting: the Minis sit
 * side by side in the group, none inside another (a Mini nests nothing, E6),
 * and the border is no frame (no head, no level). It only says they are one
 * thing's.
 *
 * The border is every entity frame's subtle ink-40 (R38), never the entity's
 * tone: the bay's Mini carries its tone.
 */

import type { ReactNode } from 'react'

export function MiniGroup({
  label,
  children,
}: {
  /** The group's accessible name ("Mech Bay"). */
  label: string
  children: ReactNode
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group, not a landmark; a <section> named here would add a region per bay
    <div role="group" aria-label={label} className="su-mini-group">
      {children}
    </div>
  )
}
