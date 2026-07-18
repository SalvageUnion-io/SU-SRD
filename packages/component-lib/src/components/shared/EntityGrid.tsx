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
 *   (DisplayCard / ReferenceEntityDisplay accept it natively, so the clone is a
 *   prop pass-through — no markup surgery); card actions ride the card's own
 *   `controls` overlay. Mode `'rail'` puts a fixed 152px right-hand callout
 *   column beside the card: a key/value dl of `footMeta` above a stacked,
 *   full-width action-button column.
 *
 * Re-implemented from ITUN's Ecflow/Erow onto shared component-lib tokens.
 */

import { cloneElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import type { CardFootMeta } from './DisplayCard'

type EntityGridProps = {
  children: ReactNode
  className?: string
}

/**
 * Entity-card grid — 1 column on mobile, max 2 on desktop, equal-height rows.
 * Gap rhythm: 26px between rows, 18px between columns.
 */
export function EntityGrid({ children, className }: EntityGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-stretch gap-x-[18px] gap-y-[26px] md:grid-cols-2',
        className
      )}
    >
      {children}
    </div>
  )
}

/** The card props EntityGridRow may inject (DisplayCard/ReferenceEntityDisplay accept these). */
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
        style={{ background: 'var(--ground-2, var(--color-su-sand))' }}
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
