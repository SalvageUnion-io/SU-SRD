/**
 * SheetSectionCard — a live sheet's opening panel (Identity, Vitals), in Read
 * and Edit alike (board 10): a flat paper panel in a light hairline, no
 * unit-colour rule on top (owner, round 8: "top border should not be pink").
 * It prints no title: the section is named for assistive tech, and the
 * contents say what they are. A titled container is a `TitledBox`.
 *
 * Keeps the `.su-sheet-section` print class for the page-break rule.
 */

import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, space } from '../../design/tokens'
import { cn } from '../../lib/cn'

type SheetSectionCardProps = {
  /** Names the section for assistive tech; never printed. */
  title: string
  /** An optional status (a DEAD stamp), at the panel's top right. */
  count?: ReactNode
  /**
   * The panel's own action chips (Mini Buttons, a ⋯ `HeaderMenu`), at its top
   * right after `count`: the panel prints no title, so this row is its head.
   */
  actions?: ReactNode
  /** Extra classes on the panel (e.g. a grid-span). */
  className?: string
  /** Extra classes on the body block (e.g. the grid gaps). */
  bodyClassName?: string
  children: ReactNode
}

/**
 * The panel: paper in a light hairline all round (ruleset §4.3; owner's
 * call, 2026-10-20: the opening panels keep 3.x's quiet frame, not a Box's
 * 2px ink, so the sheet's content carries the weight; round 8: no unit-colour
 * rule on top).
 */
const PAPER_PANEL = {
  backgroundColor: color.paper,
  borderColor: color.ink40,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  display: 'flex',
  flexDirection: 'column',
  padding: `${space[16]} ${space[20]}`,
} satisfies CSSProperties

const PAPER_COUNT = {
  marginBottom: space[12],
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space[8],
} satisfies CSSProperties

export function SheetSectionCard({
  title,
  count,
  actions,
  className,
  bodyClassName,
  children,
}: SheetSectionCardProps) {
  return (
    <section aria-label={title} className={cn('su-sheet-section', className)} style={PAPER_PANEL}>
      {(count || actions) && (
        <div style={PAPER_COUNT}>
          {count}
          {actions}
        </div>
      )}
      <div className={cn('su-sheet-section-stack', bodyClassName)}>{children}</div>
    </section>
  )
}
