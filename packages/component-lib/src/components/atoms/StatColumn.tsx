/**
 * StatColumn — the Workshop Manual's stat column at page scale (ruleset, "The
 * source": the ink stamp + framed numeral): each stat is a framed numeral
 * after an ink stamp under its full name, `STRUCTURE POINTS | 14`. It is
 * the value-cell law (§7.1) drawn the size the book draws it, so a label is
 * never squeezed into a header cell and never clips.
 *
 * Two to a row on a phone, and as many as fit at 200px from there up (board
 * 07: two columns beside the art). The cells keep the book's order: build them
 * from the entity model's `bookStats`.
 *
 * A description list, so a screen reader reads "Structure Points, 14", in the
 * order it is drawn: label first, as every chip and stat reads.
 */

/** One cell: the book's label, its value, and the stat's glossary line on hover. */
export type StatColumnCell = {
  key: string
  label: string
  value: string
  hoverText?: string
}

type StatColumnProps = {
  stats: StatColumnCell[]
  /** Names the list (`aria-label`), e.g. "Gopher stats". */
  label: string
  /**
   * The compact cells, two a line, for a narrow column beside other content
   * (the ITUN mech sheet's hero).
   */
  compact?: boolean
}

export function StatColumn({ stats, label, compact = false }: StatColumnProps) {
  if (stats.length === 0) return null
  return (
    <dl
      className={compact ? 'su-stat-column su-stat-column--compact' : 'su-stat-column'}
      aria-label={label}
    >
      {stats.map((stat) => (
        <div key={stat.key} className="su-stat-column__cell" title={stat.hoverText}>
          <dt className="su-stat-column__label">{stat.label}</dt>
          <dd className="su-stat-column__value">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
