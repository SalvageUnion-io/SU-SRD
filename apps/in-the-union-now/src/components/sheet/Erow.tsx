/**
 * Erow + Ecflow — live-sheet body card layout (design §4.1, plan 4.1).
 *
 * Ecflow: justified card rows — flex wrap, equal-height items.
 * Erow: wraps one entity card with its action economy. Mode 'card' (the
 * shipped default) injects `footActions`/`footMeta` into the card's own foot
 * — ReferenceEntityDisplay/DisplayCard accept both natively (Phase 1.2), so
 * the clone is a prop pass-through, not markup surgery. Mode 'rail' puts a
 * 152px right callout beside the card instead.
 *
 * The `grow` weight (1 / 1.2 / 1.35 / 1.45) lets meatier rules read wider
 * within a row.
 */

import { cloneElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { CardFootMeta } from 'suref-react'

import { cn } from '../../lib/utils'

type EcflowProps = {
  children: ReactNode
  className?: string
}

/** Justified card row container (design `.ecflow`). */
export function Ecflow({ children, className }: EcflowProps) {
  return <div className={cn('flex flex-wrap items-stretch gap-3.5', className)}>{children}</div>
}

/** The card props Erow may inject (ReferenceEntityDisplay accepts these). */
type ErowCardProps = {
  footActions?: ReactNode
  footMeta?: CardFootMeta[]
}

type ErowProps = {
  /** Row-weight: meatier rules read wider (design: 1 / 1.2 / 1.35 / 1.45). */
  grow?: number
  /** 'card' (default, shipped decision) folds actions into the card foot. */
  mode?: 'card' | 'rail'
  /** Action buttons for this card's economy (Use / Repair / …). */
  actions?: ReactNode
  /** Inline foot meta ('AP COST 1', 'SLOTS 2', …). */
  footMeta?: CardFootMeta[]
  children: ReactElement<ErowCardProps>
  className?: string
}

export function Erow({
  grow = 1,
  mode = 'card',
  actions,
  footMeta,
  children,
  className,
}: ErowProps) {
  const style = { flex: `${grow} 1 380px` }

  if (mode === 'card') {
    const card =
      actions || footMeta
        ? cloneElement(children, {
            ...(actions ? { footActions: actions } : {}),
            ...(footMeta ? { footMeta } : {}),
          })
        : children
    return (
      <div className={cn('min-w-[min(340px,100%)]', className)} style={style}>
        {card}
      </div>
    )
  }

  // mode 'rail': 152px right callout — meta k/v header + full-width actions.
  return (
    <div
      className={cn(
        'grid min-w-[min(340px,100%)] grid-cols-1 gap-2 sm:grid-cols-[1fr_152px]',
        className
      )}
      style={style}
    >
      {children}
      <div
        className="flex flex-col gap-2 rounded-[3px] border-[1.5px] border-wk-faint p-2.5"
        style={{ background: 'var(--ground-2)' }}
      >
        {footMeta && footMeta.length > 0 && (
          <dl className="m-0 space-y-1">
            {footMeta.map((meta) => (
              <div key={meta.label} className="flex items-baseline justify-between gap-2">
                <dt className="font-cond text-[10.5px] font-bold uppercase leading-none tracking-[0.04em] text-ink opacity-75">
                  {meta.label}
                </dt>
                <dd className="m-0 font-body text-[13px] font-bold leading-none text-ink">
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
