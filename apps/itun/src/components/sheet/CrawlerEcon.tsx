/**
 * CrawlerEcon — the crawler's VITALS column: the SP gauge, the Upgrade-pool
 * gauge, a 2-up grid of the remaining readouts, and one row of actions.
 *
 * There is no `Inset` around it any more. The column already sits in its own
 * section card, so the inset was a second frame inside the first, and its
 * "Crawler / Economy" head bar re-titled a column the section had just titled.
 *
 * The two GAUGES are the numbers that fill and empty (structure, and the pool
 * you fund toward its cap); everything left is a flat readout, so it sits in
 * the grid. Every action collects into a single row at the FOOT rather than
 * hanging off its own stat — three buttons scattered through a stat grid read
 * as three unrelated controls.
 *
 * Composes the shared primitives (style-unification pass §3): each readout is a
 * `Stat` value box (ruleset §3.7 — a label|value never hand-assembles its own
 * markup), and each action is a `Button` `variant="primary"` (§3.1 — rust is
 * the one action colour).
 *
 * Pure presentation — `SheetCrawler` still owns the economy-dialog state
 * and builds the readout data; this only renders it.
 */

import { Button, Stat, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'

export type EconLozItem = {
  /** Stat label, e.g. 'Upkeep'. */
  label: string
  /** The stat value. Paired with `max` for N/max readouts. */
  value: number
  max?: number
  /** Small caption under the stat box, e.g. 'Scrap · Tech 2+'. */
  caption?: string
  /**
   * Contribute ONLY this item's action to the foot row — no stat box. For a
   * reading that is already shown as a gauge above (the Upgrade pool) but whose
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
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: tokens.space[10],
} satisfies CSSProperties

const ACTIONS = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space[8],
} satisfies CSSProperties

const LOZ = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: tokens.space[4],
} satisfies CSSProperties

const CAPTION = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.capsWide,
  // The muted text tone: 11px caps need 4.5:1, which ink55 (3.6:1) missed.
  color: tokens.color.wkMuted,
} satisfies CSSProperties

type CrawlerEconFrameProps = {
  /** The SP `VitalGauge`. */
  gauge: ReactNode
  /** The Upgrade-pool `VitalGauge` — a second thing that fills toward a cap. */
  upgrade?: ReactNode
  items: EconLozItem[]
}

/** The vitals column: gauges, a 2-up readout grid, then one row of actions. */
export function CrawlerEconFrame({ gauge, upgrade, items }: CrawlerEconFrameProps) {
  const actions = items.filter((item) => item.action)
  const readouts = items.filter((item) => !item.actionOnly)
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labeled group (not a landmark) names the vitals column; a <section> here would become a region landmark once named
    <div role="group" aria-label="Crawler vitals" style={FRAME}>
      {gauge}
      {upgrade}
      {readouts.length > 0 && (
        <div style={READOUTS}>
          {readouts.map((item) => (
            <EconLoz key={item.label} item={item} />
          ))}
        </div>
      )}
      {actions.length > 0 && (
        // Centred: the row sits under a stack of gauges and stat plates that are
        // themselves centred in the column, so a left-aligned button row hung
        // off the edge of everything above it.
        <div style={ACTIONS}>
          {actions.map((item) => (
            <Button
              key={item.label}
              variant="primary"
              size="mini"
              aria-label={item.action?.ariaLabel}
              title={item.action?.ariaLabel}
              onClick={item.action?.onClick}
            >
              {item.action?.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/** One economy readout: a Stat value box, its caption, and the optional rust action. */
function EconLoz({ item }: { item: EconLozItem }) {
  return (
    <div style={LOZ}>
      {/* `full`: these readouts ARE the panel — the Scrap / Tech Level / Crew
          figures are meant to be read at a glance, not as annotations. Without
          the rung they rendered at 13px, which lost the poster weight the
          hand-rolled lozenge had. */}
      <Stat size="full" label={item.label} value={item.value} max={item.max} />
      {item.caption && <span style={CAPTION}>{item.caption}</span>}
    </div>
  )
}
