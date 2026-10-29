import type { CSSProperties } from 'react'
import { foregroundOn } from '../../design/contrast'
import { borderWidth, color, space, weight } from '../../design/tokens'
import { compositionsCopy } from '../../messages/components-compositions'
import { capsLabel } from '../atoms/capsLabel'
import { CHAPTER_BAND_COLOR } from '../atoms/chapterBandColor'
import { Speckle } from '../atoms/Speckle'
import { OG_CARD_HEIGHT, OG_CARD_WIDTH, OG_GUTTER, OG_NOTCH_INSET } from './ogCardText'

/**
 * BrandCard — the site's own link preview: the picture a link unfurls with
 * when the page it opens has no card of its own (the SRD's home, chapter and
 * rules pages; every app route but a shared sheet or invite, which carry
 * their own).
 *
 * It is the Discord bot's profile banner (`apps/discord-bot/brand/banner.png`)
 * redrawn to fill the 1200 × 630 of a link preview, so every surface a player
 * meets the Union on wears one face: the rules-blue chapter band with ink
 * speckle, a kicker across the top, "SALVAGE UNION.io" notched in ink on the page
 * ground, and the book's five chapter colours along the foot in book order.
 *
 * `/og-card?brand` draws it, and its screenshot is committed as the default
 * `og-image.png`, so the image exists whether or not a build renders anything.
 * Re-shoot it when it changes:
 *
 *   bun run shot '/og-card?brand' --width page        → apps/web/public/og-image.png
 */

export type BrandCardProps = {
  /** The line across the top, set in caps. */
  kicker: string
}

/** The frame: a poster's, as `OgCard`'s. */
const FRAME_WIDTH = borderWidth.poster

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
 * It is set on the entity previews' grid (`OG_GUTTER`): the kicker starts on
 * the notch's side, as an entity card's chips and cite do.
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
  fontSize: '52px',
  fontWeight: weight.extrabold,
  lineHeight: 1,
  margin: 0,
} satisfies CSSProperties
const KICKER_CAPS = capsLabel({ weight: 'inherit' })

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
  fontSize: '284px',
  fontWeight: weight.extrabold,
  lineHeight: 0.84,
  // The face's side bearing grows with its size: pull the wordmark's ink back
  // onto the inset an entity card's 120px title starts on.
  margin: '0 0 0 -0.03em', // design-tokens-ignore(raw-spacing): a fit, the face's side bearing at this size
} satisfies CSSProperties
const TITLE_CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/** ".io", set small on the second line's baseline. */
const TLD = { fontSize: '128px', textTransform: 'none' } satisfies CSSProperties

const FOOT = {
  borderTopColor: color.ink,
  borderTopStyle: 'solid',
  borderTopWidth: FRAME_WIDTH,
  display: 'flex',
  flex: '0 0 28px',
} satisfies CSSProperties

export function BrandCard({ kicker }: BrandCardProps) {
  const band = CHAPTER_BAND_COLOR.rules
  const kickerColor = foregroundOn(band, 'ink') === 'ink' ? color.ink : color.paper
  return (
    <div data-brand-card="" style={{ ...CARD, backgroundColor: band }}>
      <Speckle grain="ink" />
      <div style={BODY}>
        <p className={KICKER_CAPS} style={{ ...KICKER, color: kickerColor }}>
          {kicker}
        </p>
        <div style={NOTCH}>
          <p className={TITLE_CAPS} style={TITLE}>
            Salvage
            <br />
            Union<span style={TLD}>{compositionsCopy('io')}</span>
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
