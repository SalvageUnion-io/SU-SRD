/**
 * CrawlerEcon — the crawler sheet's economy frame: the SP `VitalGauge` over a
 * row of Tech LVL / Upkeep / Upgrade / Trade / Crew readouts, the actionable
 * ones carrying a rust action button that opens a `CrawlerEconomyControl`
 * dialog (design-review R-4). Crawler-only.
 *
 * Composes the shared primitives (style-unification pass §3): the frame is an
 * `Inset` (1.5px ink frame on paper; ink head bar with the crawler-pink tag),
 * each readout is a `Stat` value box (ruleset §3.7 — a label|value never
 * hand-assembles its own markup), and each action is a `Button`
 * `variant="primary"` (§3.1 — rust is the one action colour). This replaced
 * the poster-fidelity `.econ` magenta aside with hand-built `.loz` lozenges.
 *
 * Pure presentation — `SheetCrawler` still owns the economy-dialog state
 * and builds the readout data; this only renders it.
 */

import type { ReactNode } from 'react'
import { Button } from '../chrome/Button'
import { Inset } from '../shared/Inset'
import { Stat } from '../shared/Stat'

export type EconLozItem = {
  /** Stat label, e.g. 'Upkeep'. */
  label: string
  /** The stat value. Paired with `max` for N/max readouts. */
  value: number
  max?: number
  /** Small caption under the stat box, e.g. 'Scrap · Tech 2+'. */
  caption?: string
  /** Action button — omit for a read-only readout (e.g. Tech LVL). */
  action?: {
    /** Short button text, e.g. 'Pay' / 'Fund'. */
    label: string
    /** Full accessible name for the button (aria-label + title). */
    ariaLabel: string
    onClick: () => void
  }
}

type CrawlerEconFrameProps = {
  /** The SP `VitalGauge` — rendered at the top of the Inset body. */
  gauge: ReactNode
  items: EconLozItem[]
  className?: string
}

/** The economy Inset: SP gauge on top, the stat readout row below. */
export function CrawlerEconFrame({ gauge, items, className }: CrawlerEconFrameProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labeled group (not a landmark) names the economy frame; the Inset section can't take aria-label without becoming a region landmark
    <div role="group" aria-label="Crawler economy">
      <Inset
        tone="crawler"
        tag="Crawler"
        label="Economy"
        className={className}
        bodyClassName="flex flex-col gap-3"
      >
        {gauge}
        {items.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2.5">
            {items.map((item) => (
              <EconLoz key={item.label} item={item} />
            ))}
          </div>
        )}
      </Inset>
    </div>
  )
}

/** One economy readout: a Stat value box, its caption, and the optional rust action. */
function EconLoz({ item }: { item: EconLozItem }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Stat label={item.label} value={item.value} max={item.max} />
      {item.caption && (
        <span className="font-cond text-nano font-semibold uppercase tracking-caps-wide text-ink/55">
          {item.caption}
        </span>
      )}
      {item.action && (
        <Button
          variant="primary"
          size="xs"
          aria-label={item.action.ariaLabel}
          title={item.action.ariaLabel}
          onClick={item.action.onClick}
        >
          {item.action.label}
        </Button>
      )}
    </div>
  )
}
