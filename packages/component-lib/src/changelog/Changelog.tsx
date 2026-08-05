import { PageHeading } from '../components/chrome/PageHeading'
import { Card } from '../components/shared/Card'
import { InlineMarkdown } from '../markdownSection/InlineMarkdown'
import { cn } from '../utils/cn'
import type { ChangelogEntry } from './parseChangelog'

type ChangelogProps = {
  entries: ChangelogEntry[]
  className?: string
}

function entryHeadline(entry: ChangelogEntry): string {
  if (entry.version) return `v${entry.version}`
  return entry.title ?? entry.date
}

/**
 * Presentational, data-source-agnostic changelog renderer. Shared by both sites
 * so they render identically.
 *
 * Each entry is a **`Card`** — the generic four-band container — not a bespoke
 * listing. It previously hand-assembled a `Panel` around its own header row
 * (heading + `Badge` + `<time>`), which is the exact shape Card already models:
 * the area is the card's SEAM stamp (`label`), the version/title is the header
 * band, and the bullets are the body. Rebuilding that by hand meant the
 * changelog drifted from every other listing surface in the apps — its frame
 * weight, radius, seam placement and header padding were all set independently
 * of the card language rather than inherited from it.
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
      {entries.map((entry, index) => (
        <li key={`${entry.area}-${entry.date}-${entry.version ?? entry.title ?? index}`}>
          <Card
            label={entry.area}
            size="medium"
            frame="chrome"
            borderColor="var(--color-ink)"
            bodyPadding="px-4 pb-3 pt-1"
            headerContent={
              <>
                <PageHeading
                  variant="subheading"
                  as="h3"
                  className="leading-tight tracking-caps-tight text-ink"
                >
                  {entryHeadline(entry)}
                </PageHeading>
                <time
                  dateTime={entry.date}
                  className="ml-auto font-body text-xs text-wk-muted tabular-nums"
                >
                  {entry.date}
                </time>
              </>
            }
          >
            {entry.items.length > 0 && (
              <ul className="ml-4 list-disc space-y-1 font-body text-sm text-wk-muted marker:text-wk-muted">
                {entry.items.map((item) => (
                  <li key={item}>
                    <InlineMarkdown text={item} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </li>
      ))}
    </ol>
  )
}
