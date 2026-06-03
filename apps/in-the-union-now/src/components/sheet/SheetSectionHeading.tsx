/**
 * SheetSectionHeading — accented section heading for the live sheet sections.
 *
 * Renders an <h3> with a per-entity-kind accent: a left rule in the kind's
 * semantic color (pilot orange / mech green / crawler pink) plus the heading
 * text tinted to match. This is the per-section "divider/accent border" seam
 * that gives each sheet a clear, consistent entity accent without recoloring
 * any functional state (damage, heat, warnings).
 *
 * Purely visual and stateless — safe under readOnly / snapshot rendering.
 */

import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { sheetAccentFor } from './sheetAccent'
import type { SheetSegment } from './SheetSegmentSwitcher'

type SheetSectionHeadingProps = {
  /** Entity kind whose accent tints the rule + label. */
  kind: SheetSegment
  /** Heading text. */
  children: ReactNode
  /** Optional id for aria-labelledby wiring. */
  id?: string
  /** Extra classes appended to the default heading typography. */
  className?: string
}

export function SheetSectionHeading({ kind, children, id, className }: SheetSectionHeadingProps) {
  const accent = sheetAccentFor(kind)
  return (
    <h3
      id={id}
      className={cn(
        'mb-2 border-l-2 pl-2 font-cond text-sm font-bold uppercase tracking-wide',
        accent.border,
        accent.text,
        className
      )}
    >
      {children}
    </h3>
  )
}
