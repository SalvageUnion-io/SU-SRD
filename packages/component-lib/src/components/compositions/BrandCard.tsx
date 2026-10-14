import type { CSSProperties } from 'react'
import { foregroundOn } from '../../design/contrast'
import { borderWidth, color, font, space, tracking, weight } from '../../design/tokens'
import type { ChapterTone } from '../atoms/chapterBandColor'
import { CHAPTER_BAND_COLOR } from '../atoms/chapterBandColor'
import { Speckle } from '../atoms/Speckle'
import { OG_CARD_HEIGHT, OG_CARD_WIDTH, OG_GUTTER, OG_NOTCH_INSET } from './ogCardText'

/**
 * BrandCard — the site's own link preview: the picture a link unfurls with
 * when the page it opens has no card of its own (the SRD's home, chapter and
 * rules pages; every ITUN route but a shared sheet or invite).
 *
 * It is the Discord bot's profile banner (`apps/discord-bot/brand/banner.png`)
 * redrawn to fill the 1200 × 630 of a link preview, so every surface a player
 * meets the Union on wears one face: the rules-blue chapter band with ink
 * speckle, a kicker across the top, "SALVAGE UNION.io" notched in ink on the page
 * ground, and the book's five chapter colours along the foot in book order.
 *
 * Each app draws it on its own render surface and commits the screenshot as
 * its default `og-image.png`, so the image exists whether or not a build
 * renders anything. Re-shoot both when it changes:
 *
 *   bun run shot '/og-card?brand' --width page        → apps/srd/public/og-image.png
 *   bun run shot itun:/og/brand --width page          → apps/itun/public/og-image.png
 */

export type BrandCardProps = {
  /** The line across the top, set in caps. A `quote` takes its place. */
  kicker?: string
  /**
   * A quote across the top instead of the kicker: `text` in the caller's
   * `font` (a face the render surface loads), paper on the band, and `by`
   * under it in small caps.
   */
  quote?: { text: string; by: string; font: string }
  /**
   * The two lines notched in ink, for a product of the site rather than the
   * site itself (The Cantina's own preview). Without it the card says
   * "SALVAGE UNION.io".
   */
  title?: readonly [string, string]
  /** The band's colour. The site's card wears rules-blue; The Cantina's its pink. */
  tone?: ChapterTone
  /** Where the link goes, set at the right of the kicker's line, as typed. */
  address?: string
}

/** The frame: twice the entity card's 3px, as `OgCard`'s. */
const FRAME_WIDTH = `calc(${borderWidth.entity} * 2)`

/** The chapter colours along the foot, in the book's order. */
const FOOT_TONES = ['rules', 'pilot', 'mech', 'crawler', 'denizen'] as const

const CARD = {
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: FRAME_WIDTH,
  boxSizing: 'border-box',
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  height: OG_CARD_HEIGHT,
  isolation: 'isolate',
  overflow: 'hidden',
  position: 'relative',
  width: OG_CARD_WIDTH,
} satisfies CSSProperties

/**
 * The band: the kicker on one line, the notch filling everything under it.
 * It is set on the entity previews' grid (`OG_GUTTER`): the kicker, quote and
 * credit start on the notch's side, as an entity card's chips and cite do,
 * and the address ends on it, as the Union bar's address does.
 */
const BODY = {
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  gap: space[24],
  minHeight: 0,
  padding: `${space[24]} ${OG_GUTTER} 0`,
} satisfies CSSProperties

const KICKER = {
  fontFamily: font.cond,
  fontSize: '52px',
  fontWeight: weight.extrabold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

/**
 * The notch: the page ground, full width and standing on the foot. Unlike the
 * banner, a link preview has no avatar to clear, so the wordmark takes the
 * whole card.
 */
const NOTCH = {
  alignItems: 'center',
  backgroundColor: color.wkBg,
  boxSizing: 'border-box',
  display: 'flex',
  flex: '1 1 auto',
  minHeight: 0,
  // Set flush left at the notched title's inset, not centred: a centred
  // wordmark starts wherever its own width puts it, never on the grid.
  paddingInline: OG_NOTCH_INSET,
  // Caps sit low in their line box; this centres the ink, not the box.
  paddingBottom: space[24],
} satisfies CSSProperties

const TITLE = {
  fontFamily: font.cond,
  fontSize: '284px',
  fontWeight: weight.extrabold,
  lineHeight: 0.84,
  // The face's side bearing grows with its size: pull the wordmark's ink back
  // onto the inset an entity card's 120px title starts on.
  margin: '0 0 0 -0.03em',
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The kicker's line: the kicker, and the address at its right when there is one. */
const KICKER_ROW = {
  alignItems: 'baseline',
  display: 'flex',
  gap: space[24],
  justifyContent: 'space-between',
} satisfies CSSProperties

/** The wordmark under a quote, which stands taller than a kicker's one line. */
const QUOTED_TITLE_SIZE = '236px'

/** The quote: large, so paper reads on any band (WCAG large text). */
const QUOTE = {
  fontSize: '68px',
  fontWeight: weight.semibold,
  lineHeight: 0.95,
  // A script face sets its first capital well inside its box: pull the
  // quote's first letter back onto the text edge the credit starts on.
  margin: '0 0 0 -0.2em',
  position: 'relative',
} satisfies CSSProperties

/**
 * The opening mark hangs in the margin, so the quote's first letter, not its
 * punctuation, sits on the text edge with the credit under it.
 */
const HANGING_MARK = { position: 'absolute', right: '100%' } satisfies CSSProperties

/** Who said it: the kicker's caps, small and italic, in the band's ink. */
const QUOTE_BY = {
  fontFamily: font.cond,
  fontSize: '26px',
  fontStyle: 'italic',
  fontWeight: weight.bold,
  letterSpacing: tracking.eyebrow,
  margin: `${space[8]} 0 0`,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The address: the kicker's face, smaller and as typed (a URL is not caps). */
const ADDRESS = {
  ...KICKER,
  fontSize: '40px',
  fontWeight: weight.bold,
  textTransform: 'none',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

/** ".io", set small on the second line's baseline. */
const TLD = { fontSize: '128px', textTransform: 'none' } satisfies CSSProperties

const FOOT = {
  borderTopColor: color.ink,
  borderTopStyle: 'solid',
  borderTopWidth: FRAME_WIDTH,
  display: 'flex',
  flex: '0 0 28px',
} satisfies CSSProperties

export function BrandCard({ kicker, quote, title, tone = 'rules', address }: BrandCardProps) {
  const band = CHAPTER_BAND_COLOR[tone]
  const kickerColor = foregroundOn(band, 'ink') === 'ink' ? color.ink : color.paper
  return (
    <div data-brand-card="" style={{ ...CARD, backgroundColor: band }}>
      <Speckle grain="ink" />
      <div style={BODY}>
        <div style={KICKER_ROW}>
          {quote ? (
            <figure style={{ margin: 0 }}>
              <blockquote style={{ ...QUOTE, color: color.paper, fontFamily: quote.font }}>
                <span style={HANGING_MARK}>“</span>
                {quote.text}”
              </blockquote>
              <figcaption style={{ ...QUOTE_BY, color: kickerColor }}>— {quote.by}</figcaption>
            </figure>
          ) : (
            <p style={{ ...KICKER, color: kickerColor }}>{kicker}</p>
          )}
          {address && <p style={{ ...ADDRESS, color: kickerColor }}>{address}</p>}
        </div>
        <div style={NOTCH}>
          <p style={quote ? { ...TITLE, fontSize: QUOTED_TITLE_SIZE } : TITLE}>
            {title ? (
              <>
                {title[0]}
                <br />
                {title[1]}
              </>
            ) : (
              <>
                Salvage
                <br />
                Union<span style={TLD}>.io</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div aria-hidden="true" style={FOOT}>
        {FOOT_TONES.map((tone) => (
          <span key={tone} style={{ backgroundColor: CHAPTER_BAND_COLOR[tone], flex: '1 1 0' }} />
        ))}
      </div>
    </div>
  )
}
