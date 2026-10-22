/**
 * MiniGroup — a crawler bay's contentful Mini held in ONE border, its body
 * holding its crew lead, what it holds and its roll table (R46: the bay is
 * N3's named exception, the Mini this group holds). The border is no frame
 * (no head, no level). It only says they are one thing's.
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
