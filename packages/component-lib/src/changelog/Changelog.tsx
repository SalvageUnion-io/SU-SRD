import type { CSSProperties } from 'react'
import { PageHeading } from '../components/atoms/PageHeading'
import { Card } from '../components/containers/Card'
import { color, font, fontSize, space } from '../design/tokens'
import { InlineMarkdown } from '../markdownSection/InlineMarkdown'

const EMPTY = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  listStyle: 'none',
} satisfies CSSProperties

const BODY = {
  padding: `${space[4]} ${space[16]} ${space[12]}`,
} satisfies CSSProperties

// The bullets. Their spacing between items and their marker colour are child /
// pseudo-element selectors, so those two are `.su-changelog__items`.
const ITEMS = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  listStyleType: 'disc',
  marginLeft: space[16],
} satisfies CSSProperties

/** One day of `main`'s history for one app (`gitChangelog.ts`). */
export type ChangelogEntry = {
  /** YYYY-MM-DD. */
  date: string
  /** The card's seam stamp: which app's stream this is. */
  area: string
  /** The day's squash titles, inline markdown (a PR link). */
  items: string[]
}

type ChangelogProps = {
  entries: ChangelogEntry[]
  className?: string
}

/**
 * Presentational, data-source-agnostic changelog renderer. Shared by both sites
 * so they render identically.
 *
 * Each entry is a **`Card`** — the generic four-band container — not a bespoke
 * listing: the area is the card's SEAM stamp (`label`), the date is the header
 * band, and the bullets are the body. Hand-assembling that shape would let its
 * frame weight, radius, seam placement and header padding drift from every
 * other listing surface instead of inheriting the card language.
 *
 * The rungs it picks: `size="medium"` (this is a LIST of entries, so it takes
 * the listing density, not the dominant solo scale), `frame="chrome"` for the
 * 1.5px sub-panel weight the changelog has always had, and no `headerBg` — the
 * band stays on paper, so an entry reads as the quiet, chrome-level listing it
 * is rather than a toned entity card.
 */
export function Changelog({ entries, className }: ChangelogProps) {
  if (entries.length === 0) {
    return (
      <p className={className} style={EMPTY}>
        No changelog entries yet.
      </p>
    )
  }

  return (
    <ol className={className} style={LIST}>
      {entries.map((entry) => (
        <li key={`${entry.area}-${entry.date}`}>
          <Card
            label={entry.area}
            size="medium"
            frame="chrome"
            borderColor="var(--color-ink)"
            bodyStyle={BODY}
            headerContent={
              // `h2`, not `h3`: each entry is a direct division of the
              // changelog, which has only its own `h1` above it. `h3` skipped a
              // level (h1 -> h3), the one heading-order violation left on the
              // site once entity pages gained real section headings.
              <PageHeading variant="subheading" as="h2" className="su-changelog__date">
                <time dateTime={entry.date}>{entry.date}</time>
              </PageHeading>
            }
          >
            <ul className="su-changelog__items" style={ITEMS}>
              {entry.items.map((item) => (
                <li key={item}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ol>
  )
}
