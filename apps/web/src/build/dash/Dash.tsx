/**
 * Dash — The sheet dashboard's layout.
 *
 * `Dash` is the grid under the header strip: three columns from 80rem (what
 * the unit does, what it has, what it carries and who it is), two from 48rem,
 * one below. `DashGroup` is a group in a column: a label on a rule (the
 * `SlabSection`, drawn by the surface's look) over its body. A group's written fields
 * are the library's `Facts`, a long text its `Prose`.
 */

import type { ReactNode } from 'react'
import type { SlabCount } from '../../components/index'
import { cn, SlabSection } from '../../components/index'

export function Dash({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className="su-dash" data-cols={cols}>
      {children}
    </div>
  )
}

export function DashColumn({
  children,
  wide = false,
  label,
}: {
  children: ReactNode
  /** Takes two of the three columns (a crawler's bays). */
  wide?: boolean
  /** Names the column for assistive tech: "What Mazona does". */
  label?: string
}) {
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: a labelled group, not a landmark
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cn('su-dash__col', wide && 'su-dash__col--wide')}
    >
      {children}
    </div>
  )
}

export function DashGroup({
  title,
  tally,
  actions,
  children,
}: {
  title: ReactNode
  tally?: ReactNode | SlabCount | readonly SlabCount[]
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <SlabSection
      as="h2"
      title={title}
      count={tally}
      actions={actions}
      bodyClassName="su-dash-group__body"
    >
      {children}
    </SlabSection>
  )
}
