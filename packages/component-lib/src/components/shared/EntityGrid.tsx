/**
 * EntityGrid — the shared entity-card grid + action-economy injector.
 *
 * A LAYOUT primitive, not a card. Two named exports:
 *
 * - `EntityGrid`: the entity-card grid. ONE column on mobile, capped at TWO
 *   columns on desktop (the poster rule: no entity-card grid exceeds two
 *   columns), rows made equal-height (`items-stretch`). Gap rhythm 26px between
 *   rows / 18px between columns.
 * - `EntityGridRow`: wraps one entity card with its action economy. Mode
 *   `'card'` (default) folds `footMeta` into the child card's own foot
 *   (Card / ReferenceEntityCard accept it natively, so the clone is a
 *   prop pass-through — no markup surgery); card actions ride the card's own
 *   `controls` overlay. Mode `'rail'` puts a fixed 152px right-hand callout
 *   column beside the card: a key/value dl of `footMeta` above a stacked,
 *   full-width action-button column.
 *
 * Re-implemented from ITUN's Ecflow/Erow (since deleted — the sheets render
 * through this primitive now) onto shared component-lib tokens.
 */

import { cloneElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import type { CardFootMeta } from './Card'

type EntityGridProps = {
  children: ReactNode
  /**
   * Max desktop column count. `2` (default) keeps the original two-column cap.
   * `3` opts into the three-across ladder the Workshop-Manual live sheets use
   * (abilities / systems & modules / bays), matching the printed sheets; it
   * still steps down to 2 at tablet and 1 on mobile so a card never crushes.
   */
  columns?: 2 | 3
  /**
   * MASONRY: pack cards by column instead of by row, so each card is only as
   * tall as its own content and the next one starts immediately beneath it.
   *
   * The default row grid stretches every card in a row to the tallest of them
   * (`items-stretch`), which is right when the cards are peers of similar
   * weight and wrong when they are not — a crawler's bays range from a one-line
   * Storage Bay to a Mech Bay carrying a crew inset and a docked-mech line, and
   * row alignment gave every short bay a slab of dead paper to match its
   * tallest neighbour.
   *
   * Implemented with CSS multi-column, not `grid-template-rows: masonry`, which
   * is still not in a stable browser. That choice has one visible consequence
   * worth knowing: multi-column fills columns top-to-bottom, so reading order
   * runs DOWN each column rather than across each row.
   */
  masonry?: boolean
  className?: string
}

/**
 * Entity-card grid — 1 column on mobile, up to `columns` on desktop (default
 * 2). Rows are equal-height by default; `masonry` packs by column instead.
 * Gap rhythm: 26px between rows, 18px between columns.
 */
export function EntityGrid({ children, columns = 2, masonry = false, className }: EntityGridProps) {
  if (masonry) {
    return (
      <div
        className={cn(
          // `gap` is column-gap in a multi-column box; the row rhythm is the
          // children's own bottom margin, and `break-inside-avoid` is what stops
          // a card being sliced across a column boundary. Both are applied from
          // here rather than in EntityGridRow so the row primitive stays
          // layout-agnostic and every child (row-wrapped or bare) is covered.
          'columns-1 gap-4 md:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid',
          columns === 3 && 'xl:columns-3',
          className
        )}
      >
        {children}
      </div>
    )
  }
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-stretch gap-x-4 gap-y-6 md:grid-cols-2',
        columns === 3 && 'xl:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  )
}

/** The card props EntityGridRow may inject (Card/ReferenceEntityCard accept these). */
type InjectableCardProps = {
  footMeta?: CardFootMeta[]
}

type EntityGridRowProps = {
  /** `'card'` (default) folds the economy into the card foot; `'rail'` puts a 152px callout beside it. */
  mode?: 'card' | 'rail'
  /** Action buttons for this card's economy (Use / Repair / Pay / Fund). */
  actions?: ReactNode
  /** Inline foot meta (e.g. EP · 2, +HEAT · 1). */
  footMeta?: CardFootMeta[]
  /** The entity card to wrap (accepts `footMeta` when mode is `'card'`). */
  children: ReactElement<InjectableCardProps>
  className?: string
}

export function EntityGridRow({
  mode = 'card',
  actions,
  footMeta,
  children,
  className,
}: EntityGridRowProps) {
  if (mode === 'card') {
    const card = footMeta ? cloneElement(children, { footMeta }) : children
    return <div className={cn('min-w-0', className)}>{card}</div>
  }

  // mode 'rail': fixed 152px right callout — meta k/v header + full-width actions.
  return (
    <div className={cn('grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_152px]', className)}>
      {children}
      <div
        className="flex flex-col gap-2 rounded-card border-chrome border-wk-faint p-2.5"
        style={{ background: 'var(--ground-2, var(--color-ink-8))' }}
      >
        {footMeta && footMeta.length > 0 && (
          <dl className="m-0 space-y-1">
            {footMeta.map((meta) => (
              <div key={meta.label} className="flex items-baseline justify-between gap-2">
                <dt className="font-cond text-label-lg font-bold uppercase leading-none tracking-caps-tight text-ink opacity-75">
                  {meta.label}
                </dt>
                <dd className="m-0 font-body text-caption font-bold leading-none text-ink">
                  {meta.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {actions && <div className="flex flex-col gap-1.5 *:w-full">{actions}</div>}
      </div>
    </div>
  )
}
