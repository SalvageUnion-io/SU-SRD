import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'

/** Ontological tone for the head-bar tag (pilot orange / mech green / crawler pink). */
export type InsetTone = 'pilot' | 'mech' | 'crawler'

type InsetProps = {
  /** Head-bar title — condensed caps, paper on the ink bar. */
  label: ReactNode
  /** Colours the head-bar tag; omit for a paper (untoned) tag. */
  tone?: InsetTone
  /** Short keyword stamped at the head-bar's left edge, e.g. 'CREW'. */
  tag?: string
  /** Right-edge head-bar slot — a subtitle, meta readout, or actions. */
  headRight?: ReactNode
  /** Extra classes on the outer frame. */
  className?: string
  /** Extra classes on the padded body wrapper (e.g. a flex layout). */
  bodyClassName?: string
  children: ReactNode
}

/**
 * Inset — a boxed sub-panel meant to sit inside a parent card's expand slot
 * (generalises ITUN's NpcInset crew-lead card and CrawlerEcon economy frame).
 *
 * Anatomy: a 1.5px ink frame on paper, an ink head bar carrying an optional
 * tone tag + a title (+ an optional right-edge subtitle/actions slot), over a
 * padded body (`children`). It is the closed, self-contained counterpart to
 * `Slab`'s open in-flow section leader — use Inset when an expanded entity
 * needs a bordered tracked-detail card, not a page-flow section.
 */
export function Inset({
  label,
  tone,
  tag,
  headRight,
  className,
  bodyClassName,
  children,
}: InsetProps) {
  return (
    <section
      className={cn('overflow-hidden rounded-card border-chrome border-ink bg-paper', className)}
    >
      <div className="flex flex-wrap items-center gap-2 bg-ink px-2 py-1.5">
        {tag && (
          <Badge surface={tone ? 'tone' : 'ghost'} tone={tone}>
            {tag}
          </Badge>
        )}
        <span className="min-w-0 font-cond text-lede font-bold uppercase leading-none tracking-caps-tight text-paper">
          {label}
        </span>
        {headRight != null && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5">{headRight}</span>
        )}
      </div>
      <div className={cn('p-2.5', bodyClassName)}>{children}</div>
    </section>
  )
}
