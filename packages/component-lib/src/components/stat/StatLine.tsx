import { Fragment } from 'react'

export type StatLineItem = {
  /** Short stat name as printed — "SP", "EP", "Heat", "Bays". */
  label: string
  value: number
  max: number
  /** Trailing word after the fraction ("Intact" in "Bays 4/5 Intact"). */
  suffix?: string
}

type StatLineProps = {
  items: StatLineItem[]
  className?: string
}

/**
 * StatLine — vitals as INLINE NUMERIC TEXT: `SP 9/13 · EP 6/11 · Heat 4/12`.
 *
 * This is deliberately NOT `Stat` / `StatsBar` / a gauge. The rail body is
 * specified as running text rather than pips (poster `.rail-body`), so the two
 * presentations are different jobs, not a duplication to be merged — feeding
 * rail stats through the pip components would be the actual regression.
 *
 * What it replaces is the triplication on the other side: `MechRailStats`,
 * `PilotRailStats` and `CrawlerRailStats` each hand-wrote this identical
 * markup and differed only in WHICH stats they listed. Those collapse to thin
 * adapters that map their domain record onto `items`; the rules math stays in
 * the app (component-lib is data-source agnostic, ADR-010).
 */
export function StatLine({ items, className }: StatLineProps) {
  return (
    <span className={className}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && ' · '}
          {item.label}{' '}
          <b>
            {item.value}/{item.max}
          </b>
          {item.suffix ? ` ${item.suffix}` : null}
        </Fragment>
      ))}
    </span>
  )
}
