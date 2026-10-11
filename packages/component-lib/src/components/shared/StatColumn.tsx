import type { BookStat } from '../referenceEntity/referenceEntityStatsConfig'

/**
 * StatColumn — the Workshop Manual's stat column at page scale (ruleset, "The
 * source": the framed numeral + ink stamp): each stat is a framed numeral
 * beside an ink stamp in the book's own wording, `14 | STRUCTURE PTS.`. It is
 * the value-cell law (§7.1) drawn the size the book draws it, so a label is
 * never squeezed into a header cell and never clips.
 *
 * Two to a row on a phone, and as many as fit at 200px from there up (board
 * 07: two columns beside the art). The cells keep the book's order: build them
 * with `buildBookStats`.
 *
 * A description list, so a screen reader reads "Structure Pts., 14": the
 * numeral is drawn first by `row-reverse`, not by source order.
 */

type StatColumnProps = {
  stats: BookStat[]
  /** Names the list (`aria-label`), e.g. "Gopher stats". */
  label: string
}

export function StatColumn({ stats, label }: StatColumnProps) {
  if (stats.length === 0) return null
  return (
    <dl className="su-stat-column" aria-label={label}>
      {stats.map((stat) => (
        <div key={stat.key} className="su-stat-column__cell" title={stat.hoverText}>
          <dt className="su-stat-column__label">{stat.label}</dt>
          <dd className="su-stat-column__value">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
