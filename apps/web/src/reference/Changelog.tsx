import type { CSSProperties } from 'react'
import { CHAPTER_BAND_COLOR, EmptyState, InlineMarkdown, TitledBox } from '../components/index'
import { color, font, fontSize, space } from '../design/tokens'
import { referenceCopy } from '../messages/reference'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  listStyle: 'none',
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

/** One day of `main`'s history (`gitChangelog.ts`). */
export type ChangelogEntry = {
  /** YYYY-MM-DD. */
  date: string
  /** The day's squash titles, inline markdown (a PR link). */
  items: string[]
}

type ChangelogProps = {
  entries: ChangelogEntry[]
}

/** The band: the changelog's chapter, rules blue (the page's own band), ink speckled. */
const BAND = {
  background: CHAPTER_BAND_COLOR.rules,
  color: 'var(--color-ink)',
  grain: 'ink',
  ink: false,
} as const

/**
 * Presentational, data-source-agnostic renderer for `/changelog`.
 *
 * Each entry is a `TitledBox`, the cut-out head every other card wears: a band
 * in the page's rules blue, the date notched into its foot on a tab of the
 * paper below (in ink). The bullets are the paper body the tab opens into.
 */
export function Changelog({ entries }: ChangelogProps) {
  if (entries.length === 0) {
    return <EmptyState variant="quiet" body={referenceCopy('noChangelogEntriesYet')} />
  }

  return (
    <ol style={LIST}>
      {entries.map((entry) => (
        <li key={entry.date}>
          {/* `h2`: each entry is a direct division of the changelog, under
              its one `h1`. */}
          <TitledBox
            as="article"
            title={entry.date}
            titleContent={<time dateTime={entry.date}>{entry.date}</time>}
            titleAs="h2"
            paint={BAND}
          >
            <ul className="su-changelog__items" style={ITEMS}>
              {entry.items.map((item) => (
                <li key={item}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          </TitledBox>
        </li>
      ))}
    </ol>
  )
}
