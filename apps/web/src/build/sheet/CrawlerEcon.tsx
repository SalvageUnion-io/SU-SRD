/**
 * CrawlerEcon — the crawler's VITALS column: the SP gauge, the Upgrade-pool
 * gauge and a 2-up grid of the remaining readouts (`CrawlerEconFrame`), and
 * the column's action chips (`CrawlerEconActions`).
 *
 * There is no titled box around it any more. The column already sits in its own
 * section card, so the inset was a second frame inside the first, and its
 * "Crawler / Economy" head bar re-titled a column the section had just titled.
 *
 * The two GAUGES are the numbers that fill and empty (structure, and the pool
 * you fund toward its cap); everything left is a flat readout, so it sits in
 * the grid. Every action collects onto the Vitals card's HEAD as a Mini chip
 * (`SheetHero`'s `vitalsActions`) rather than hanging off its own stat or
 * sitting in a body row: a contextual action lives on its owner's head.
 *
 * Composes the shared primitives (style-unification pass §3): each readout is a
 * `Stat` value box (ruleset §3.7 — a label|value never hand-assembles its own
 * markup), and each action is a `Button` `variant="primary"` (§3.1 — rust is
 * the one action colour).
 *
 * Pure presentation — `CrawlerLiveSheet` still owns the economy-dialog state
 * and builds the readout data; this only renders it.
 */

import type { CSSProperties, ReactNode } from 'react'
import { capsLabel } from '../../components/atoms/capsLabel'
import { Button, Stat, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

export type EconLozItem = {
  /** Stat label, e.g. 'Upkeep'. */
  label: string
  /** The stat value. Paired with `max` for N/max readouts. */
  value: number
  max?: number
  /** Small caption under the stat box, e.g. 'T2+ Scrap'. */
  caption?: string
  /**
   * Contribute ONLY this item's action to the head chips — no stat box. For a
   * reading that is already shown as a gauge (the Upgrade pool) but whose
   * action still belongs with the others.
   */
  actionOnly?: boolean
  /** Action button — omit for a read-only readout (e.g. Tech LVL). */
  action?: {
    /** Short button text, e.g. 'Pay' / 'Fund'. */
    label: string
    /** Full accessible name for the button (aria-label + title). */
    ariaLabel: string
    onClick: () => void
  }
}

const FRAME = {
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

const READOUTS = {
  display: 'grid',
  gap: tokens.space[8],
} satisfies CSSProperties

/** Two readouts a row; a lone one the row's width, so it centres. */
const readoutColumns = (count: number) => `repeat(${Math.min(count, 2)}, minmax(0, 1fr))`

const LOZ = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: tokens.space[4],
} satisfies CSSProperties

const CAPTION = {
  // The muted text tone: 11px caps need 4.5:1, which ink55 (3.6:1) missed.
  color: tokens.color.wkMuted,
} satisfies CSSProperties
const CAPTION_CAPS = capsLabel({ size: 'badge', weight: 'semibold' })

type CrawlerEconFrameProps = {
  /** The SP `VitalGauge`. */
  gauge: ReactNode
  /** The Upgrade-pool `VitalGauge` — a second thing that fills toward a cap. */
  upgrade?: ReactNode
  items: EconLozItem[]
}

/** The vitals column: gauges, then a 2-up readout grid. */
export function CrawlerEconFrame({ gauge, upgrade, items }: CrawlerEconFrameProps) {
  const readouts = items.filter((item) => !item.actionOnly)
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labeled group (not a landmark) names the vitals column; a <section> here would become a region landmark once named
    <div role="group" aria-label={buildSheetCopy('crawlerVitals')} style={FRAME}>
      {gauge}
      {upgrade}
      {readouts.length > 0 && (
        // One readout (the Upkeep) centres in the column.
        <div style={{ ...READOUTS, gridTemplateColumns: readoutColumns(readouts.length) }}>
          {readouts.map((item) => (
            <EconLoz key={item.label} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The items' actions as the Vitals card's head chips: rust (§3.1), Mini. */
export function CrawlerEconActions({ items }: { items: readonly EconLozItem[] }) {
  return items.map(
    ({ label, action }) =>
      action && (
        <Button
          key={label}
          variant="primary"
          size="mini"
          aria-label={action.ariaLabel}
          title={action.ariaLabel}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )
  )
}

/** One economy readout: a Stat value box and its caption. */
function EconLoz({ item }: { item: EconLozItem }) {
  return (
    <div style={LOZ}>
      {/* A label-first chip, as every stat reads; `full` is the reading rung. */}
      <Stat label={item.label} value={item.value} max={item.max} />
      {item.caption && (
        <span className={CAPTION_CAPS} style={CAPTION}>
          {item.caption}
        </span>
      )}
    </div>
  )
}
