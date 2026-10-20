import type { CSSProperties } from 'react'
import type { StatGroup } from 'salvageunion-reference'
import { Stat } from './Stat'

/**
 * StatColumn — the Workshop Manual's stat column at page scale (ruleset, "The
 * source": the ink stamp + framed numeral): each stat is a framed numeral
 * after an ink stamp under its full name, `STRUCTURE POINTS | 14`. It is
 * the value-cell law (§7.1) drawn the size the book draws it, so a label is
 * never squeezed into a header cell and never clips.
 *
 * Two to a row on a phone, and as many as fit at 200px from there up (board
 * 07: two columns beside the art). The cells keep the stat order: build them
 * from the entity model's `bookStats`. They fill the rows from the top down,
 * and every row spans the column: a short last row's cells stretch to share
 * it, so there is never an empty cell or a ragged edge (`stat-fill.e2e.ts`).
 *
 * A layout of `Stat`s (ruleset §3.7, §6.2: every labelled value is a Stat,
 * no hand `dl`), each a list item, so a screen reader reads "Structure
 * Points 14" in the order it is drawn: label first, as every chip and stat
 * reads. The book's scale (the 14px label, the title-face numeral, R17) is
 * the column's stylesheet over the Stat's own plates and 1px frame (§7.1).
 */

/** One cell: the book's label, its value, and the stat's glossary line on hover. */
export type StatColumnCell = {
  key: string
  label: string
  value: string
  hoverText?: string
  /** Its part of the stat order (provenance, vitals, capacity). */
  group?: StatGroup
}

type StatColumnProps = {
  stats: StatColumnCell[]
  /** Names the list (`aria-label`), e.g. "Gopher stats". */
  label: string
  /**
   * The compact cells, two a line, for a narrow column beside other content
   * (the app mech sheet's hero). They flow on without a row break per group.
   */
  compact?: boolean
  /** A cell's own style, by its index (a band's fill order, `EntityPageStamps`). */
  cellStyle?: (index: number) => CSSProperties
}

export function StatColumn({ stats, label, compact = false, cellStyle }: StatColumnProps) {
  if (stats.length === 0) return null
  return (
    <ul
      className={compact ? 'su-stat-column su-stat-column--compact' : 'su-stat-column'}
      aria-label={label}
    >
      {stats.map((stat, index) => (
        <li
          key={stat.key}
          className="su-stat-column__cell"
          title={stat.hoverText}
          style={cellStyle?.(index)}
        >
          <Stat label={stat.label} value={stat.value} className="su-stat-column__stat" />
        </li>
      ))}
    </ul>
  )
}
