import { Badge, CHAPTER_BAND_COLOR, InlineMarkdown } from 'component-lib'
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
  /** Which app's stream this is: the stamp right of the date. */
  area: string
  /** The day's squash titles, inline markdown (a PR link). */
  items: string[]
}

type ChangelogProps = {
  entries: ChangelogEntry[]
}

/** The band: the changelog's chapter, rules blue (the page's own band). */
const BAND = { backgroundColor: CHAPTER_BAND_COLOR.rules } satisfies CSSProperties

/**
 * Presentational, data-source-agnostic changelog renderer for the changelog
 * both tools share (the SRD's `/changelog`).
 *
 * Each entry is a framed card with the cut-out head every other card wears:
 * a band in the page's rules blue, the date notched into its foot on a tab of
 * the paper below (in ink), and the area ("Site", "App") as a stamp right of
 * it, where a card's labels sit (EDL E9). The bullets are the paper body the
 * tab opens into. The frame, band and notch are `.srd-changelog__*`.
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
            <div className="srd-changelog__band su-grain--ink" style={BAND}>
              {/* `h2`: each entry is a direct division of the changelog, under
                  its one `h1`. */}
              <h2 className="srd-changelog__date">
                <time dateTime={entry.date}>{entry.date}</time>
              </h2>
              <Badge shape="stamp" size="mini" className="srd-changelog__area">
                {entry.area}
              </Badge>
            </div>
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
