import { CHAPTER_BAND_COLOR, Head, InlineMarkdown, Stat } from 'component-lib'
import { color, font, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

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

// The bullets. Their spacing between items and their marker colour are child /
// pseudo-element selectors, so those two are `.srd-changelog__items`.
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
  /** Which app's stream this is: the chip right of the date. */
  area: string
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
  nameOnPaper: false,
} as const

/**
 * Presentational, data-source-agnostic changelog renderer for the changelog
 * both tools share (the SRD's `/changelog`).
 *
 * Each entry is a framed card with the cut-out head every other card wears
 * (the shared `Head`): a band in the page's rules blue, the date notched into
 * its foot on a tab of the paper below (in ink), and the area ("Site", "App")
 * as a chip right of it, as an entity's chips sit in its cut-out head (E17).
 * The bullets are the paper body the tab opens into. The frame is
 * `.srd-changelog__entry`.
 */
export function Changelog({ entries }: ChangelogProps) {
  if (entries.length === 0) {
    return <p style={EMPTY}>No changelog entries yet.</p>
  }

  return (
    <ol style={LIST}>
      {entries.map((entry) => (
        <li key={`${entry.area}-${entry.date}`}>
          <article className="srd-changelog__entry">
            {/* `h2`: each entry is a direct division of the changelog, under
                its one `h1`. */}
            <Head
              title={entry.date}
              titleContent={<time dateTime={entry.date}>{entry.date}</time>}
              titleAs="h2"
              paint={BAND}
              chips={
                <div className="su-chips">
                  <Stat orientation="horizontal" label={entry.area} size="compact" />
                </div>
              }
              notch
              chipsBeside
            />
            <ul className="srd-changelog__items" style={ITEMS}>
              {entry.items.map((item) => (
                <li key={item}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          </article>
        </li>
      ))}
    </ol>
  )
}
