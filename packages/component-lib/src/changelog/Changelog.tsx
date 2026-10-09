import { PageHeading } from '../components/chrome/PageHeading'
import { Card } from '../components/shared/Card'
import { InlineMarkdown } from '../markdownSection/InlineMarkdown'
import { cn } from '../utils/cn'

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
      <p className={cn('font-body text-caption text-wk-muted', className)}>
        No changelog entries yet.
      </p>
    )
  }

  return (
    <ol className={cn('flex list-none flex-col gap-4', className)}>
      {entries.map((entry) => (
        <li key={`${entry.area}-${entry.date}`}>
          <Card
            label={entry.area}
            size="medium"
            frame="chrome"
            borderColor="var(--color-ink)"
            bodyPadding="px-4 pb-3 pt-1"
            headerContent={
              // `h2`, not `h3`: each entry is a direct division of the
              // changelog, which has only its own `h1` above it. `h3` skipped a
              // level (h1 -> h3), the one heading-order violation left on the
              // site once entity pages gained real section headings.
              <PageHeading
                variant="subheading"
                as="h2"
                className="leading-tight tracking-caps-tight text-ink tabular-nums"
              >
                <time dateTime={entry.date}>{entry.date}</time>
              </PageHeading>
            }
          >
            <ul className="ml-4 list-disc space-y-1 font-body text-sm text-wk-muted marker:text-wk-muted">
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
