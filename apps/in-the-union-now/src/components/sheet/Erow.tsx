/**
 * Erow + Ecflow — live-sheet body card layout (design §4.1, plan 4.1;
 * redesign: poster grid).
 *
 * Ecflow: the entity-card grid — capped at TWO columns on desktop and ONE on
 * mobile (redesign rule: max 2 columns for any entity-card grid), equal-height
 * items.
 * Erow: wraps one entity card with its action economy. Mode 'card' (the
 * shipped default) injects `footActions`/`footMeta` into the card's own foot
 * — ReferenceEntityDisplay/DisplayCard accept both natively (Phase 1.2), so
 * the clone is a prop pass-through, not markup surgery. Mode 'rail' puts a
 * 152px right callout beside the card instead.
 */

import { cloneElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { CardFootMeta } from 'suref-react'

import { LAYOUT } from '../../lib/layout'
import { cn } from '../../lib/utils'

type EcflowProps = {
  children: ReactNode
  className?: string
}

/**
 * Entity-card grid (design `.abgrid`/`.ecflow`) — 1 column on mobile, max 2 on
 * desktop. Gap rhythm matches the poster's `.abgrid{gap:26px 18px}`
 * (clean-pilot.html:441-444) — 26px between rows, 18px between columns.
 */
export function Ecflow({ children, className }: EcflowProps) {
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

/** The card props Erow may inject (ReferenceEntityDisplay accepts these). */
type ErowCardProps = {
  footActions?: ReactNode
  footMeta?: CardFootMeta[]
}

type ErowProps = {
  /** 'card' (default, shipped decision) folds actions into the card foot. */
  mode?: 'card' | 'rail'
  /** Action buttons for this card's economy (Use / Repair / …). */
  actions?: ReactNode
  /** Inline foot meta ('AP COST 1', 'SLOTS 2', …). */
  footMeta?: CardFootMeta[]
  children: ReactElement<ErowCardProps>
  className?: string
}

export function Erow({ mode = 'card', actions, footMeta, children, className }: ErowProps) {
  if (mode === 'card') {
    const card =
      actions || footMeta
        ? cloneElement(children, {
            ...(actions ? { footActions: actions } : {}),
            ...(footMeta ? { footMeta } : {}),
          })
        : children
    return <div className={cn('min-w-0', className)}>{card}</div>
  }

  // mode 'rail': 152px right callout — meta k/v header + full-width actions.
  return (
    <div className={cn('grid min-w-0 grid-cols-1 gap-2', LAYOUT.erowGrid, className)}>
      {children}
      <div
        className="flex flex-col gap-2 rounded-[3px] border-chrome border-wk-faint p-2.5"
        style={{ background: 'var(--ground-2)' }}
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
