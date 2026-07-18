/**
 * CrawlerEcon — the crawler poster's `.econ` economy frame (redesign
 * fidelity pass, deferred from Phase 4c): a magenta `--tone` aside wrapping
 * the SP `VitalGauge` (in a paper `.gaugebox`) over a row of `.loz`
 * lozenges (Tech LVL / Upkeep / Upgrade / Trade / Crew), each an oversized
 * number + label + an optional `.lact` action chip for the readouts that
 * open a `CrawlerEconomyControl` dialog (design-review R-4). Crawler-only —
 * mirrors clean-crawler.html's `.econ` / `.gaugebox` / `.lozrow` / `.loz` /
 * `.lact`, adapted from the poster's fixed 192px aside to this app's
 * full-width Identity-card placement (an auto-fit grid replaces the
 * poster's width-driven 3-col/1-col swap).
 *
 * Pure presentation — `SheetCrawler` still owns the economy-dialog state
 * and builds the lozenge data; this only renders it in the poster's
 * lozenge shape instead of the shared ChassisStats/StatBlock (which is
 * untouched and keeps serving the other sheets' spec strips).
 */

import type { ReactNode } from 'react'
import { Badge } from 'component-lib'

import { cn } from '../../lib/utils'

export type EconLozItem = {
  /** `.llabel` — top caption, e.g. 'Upkeep'. */
  label: string
  /** `.lnum` — the big number. Paired with `max` for N/max readouts. */
  value: number
  max?: number
  /** `.lcap` — small caption under the number, e.g. 'Scrap · Tech 2+'. */
  caption?: string
  /** `.lact` action chip — omit for a read-only readout (e.g. Tech LVL). */
  action?: {
    /** Short chip text, e.g. 'Pay' / 'Fund'. */
    label: string
    /** Full accessible name for the button (aria-label + title). */
    ariaLabel: string
    onClick: () => void
  }
}

type CrawlerEconFrameProps = {
  /** The SP `VitalGauge` — rendered inside the poster's paper `.gaugebox`. */
  gauge: ReactNode
  items: EconLozItem[]
  className?: string
}

/** The `.econ` magenta aside: `.gaugebox` on top, `.lozrow` below. */
export function CrawlerEconFrame({ gauge, items, className }: CrawlerEconFrameProps) {
  return (
    <aside
      aria-label="Crawler economy"
      className={cn('flex flex-col gap-3 rounded-[3px] border-entity p-3', className)}
      style={{ borderColor: 'var(--tone)', background: 'var(--tone)' }}
    >
      <div className="rounded-[3px] bg-paper px-3 py-2.5">{gauge}</div>
      {items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2.5">
          {items.map((item) => (
            <EconLoz key={item.label} item={item} />
          ))}
        </div>
      )}
    </aside>
  )
}

/** One `.loz` lozenge: label, big number(/max), caption, optional `.lact` chip. */
function EconLoz({ item }: { item: EconLozItem }) {
  const body = (
    <>
      <span
        className="font-cond text-[10px] font-bold uppercase tracking-caps"
        style={{ color: 'var(--tone-deep)' }}
      >
        {item.label}
      </span>
      <div className="font-cond text-[26px] font-bold leading-[1.05] tabular-nums text-ink">
        {item.value}
        {item.max !== undefined && (
          <>
            <i className="px-0.5 not-italic text-[15px] text-ink/55">/</i>
            <span className="text-[15px] text-ink/70">{item.max}</span>
          </>
        )}
      </div>
      {item.caption && (
        <span className="font-cond text-[8px] font-semibold uppercase tracking-[0.16em] text-ink/55">
          {item.caption}
        </span>
      )}
      {item.action && <Badge className="mt-1 bg-[var(--tone-deep)]">{item.action.label}</Badge>}
    </>
  )

  const frameClass =
    'flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[3px] border-2 border-ink bg-paper px-1.5 py-2 text-center'

  if (!item.action) {
    return <div className={frameClass}>{body}</div>
  }

  const action = item.action
  return (
    <button
      type="button"
      aria-label={action.ariaLabel}
      title={action.ariaLabel}
      onClick={action.onClick}
      className={cn(
        frameClass,
        'cursor-pointer shadow-[0_2.5px_0_var(--color-ink)] transition-transform duration-[120ms] hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_var(--color-ink)]'
      )}
    >
      {body}
    </button>
  )
}
