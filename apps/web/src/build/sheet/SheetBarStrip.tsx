/**
 * The condensed bar's contents (`LiveSheet`), once the band scrolls away: the
 * name on its cut-out (callsign, real name, what it is), then each vital as a
 * tracker, its figure over its max on a thin fill, critical in rust when low
 * (or when Heat runs high).
 */

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { LiveSheetStripItem } from './LiveSheet'

/** A vital's fill (0–1), or nothing when it has no max. */
function fillOf(item: LiveSheetStripItem): number | undefined {
  if (item.max === undefined || item.max <= 0) return undefined
  return Math.max(0, Math.min(1, item.value / item.max))
}

/** Critical: a pool at a quarter or less, Heat at three quarters or more. */
function stateOf(item: LiveSheetStripItem, fill: number | undefined) {
  if (fill === undefined) return undefined
  const critical = item.key === 'heat' ? fill >= 0.75 : fill <= 0.25
  return critical ? 'critical' : undefined
}

export function SheetBarStrip({
  title,
  nameAside,
  kind,
  items,
}: {
  title: ReactNode
  nameAside?: ReactNode
  /** What the unit is ("Mech · Mule"). */
  kind: string
  items: readonly LiveSheetStripItem[]
}) {
  return (
    <>
      <span className="su-sheet-bar__name">
        <b>{title}</b>
        {nameAside && <span>{nameAside}</span>}
        <small>{kind}</small>
      </span>
      {items.map((item) => {
        const fill = fillOf(item)
        return (
          <span
            key={item.key}
            className={cn(
              'su-sheet-bar__vital',
              item.mobilePriority === false && 'su-sheet-live-stat-fold'
            )}
            data-state={stateOf(item, fill)}
          >
            <span className="su-sheet-bar__label">{item.label}</span>
            <span className="su-sheet-bar__figure">
              <b>{item.value}</b>
              {item.max !== undefined && <i>/{item.max}</i>}
            </span>
            {fill !== undefined && (
              <span
                className="su-sheet-bar__meter"
                style={{ '--su-fill': fill } as CSSProperties}
              />
            )}
          </span>
        )
      })}
    </>
  )
}
