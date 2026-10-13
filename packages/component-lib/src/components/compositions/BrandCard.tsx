import type { CSSProperties } from 'react'
import { borderWidth, color, font, space, tracking, weight } from '../../design/tokens'
import { CHAPTER_BAND_COLOR } from '../atoms/chapterBandColor'
import { Speckle } from '../atoms/Speckle'
import { OG_CARD_HEIGHT, OG_CARD_WIDTH } from './ogCardText'

/**
 * BrandCard — the site's own link preview: the picture a link unfurls with
 * when the page it opens has no card of its own (the SRD's home, chapter and
 * rules pages; every ITUN route but a shared sheet or invite).
 *
 * It is the Discord bot's profile banner (`apps/discord-bot/brand/banner.png`)
 * redrawn at the 1200 × 630 of a link preview, so every surface a player
 * meets the Union on wears one face: the rules-blue chapter band with ink
 * speckle, a kicker top left, "SALVAGE UNION.io" notched in ink on the page
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
  /** The line top left, set in caps over two lines. */
  kicker: string
}

/** The frame: twice the entity card's 3px, as `OgCard`'s. */
const FRAME_WIDTH = `calc(${borderWidth.entity} * 2)`

/** The chapter colours along the foot, in the book's order. */
const FOOT_TONES = ['rules', 'pilot', 'mech', 'crawler', 'denizen'] as const

const CARD = {
  backgroundColor: CHAPTER_BAND_COLOR.rules,
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

const ROW = {
  display: 'flex',
  flex: '1 1 auto',
  gap: space[32],
  justifyContent: 'space-between',
  minHeight: 0,
  padding: `${space[40]} ${space[40]} 0 ${space[48]}`,
} satisfies CSSProperties

const KICKER = {
  fontFamily: font.cond,
  fontSize: '48px',
  fontWeight: weight.extrabold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.15,
  margin: 0,
  maxWidth: '7.5em',
  paddingTop: space[12],
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The notch: the page ground, standing on the foot as the banner's does. */
const NOTCH = {
  backgroundColor: color.wkBg,
  boxSizing: 'border-box',
  display: 'flex',
  flex: '0 0 62%',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: `0 ${space[40]}`,
} satisfies CSSProperties

const TITLE = {
  fontFamily: font.cond,
  fontSize: '178px',
  fontWeight: weight.extrabold,
  lineHeight: 0.98,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** ".io", set small on the second line's baseline. */
const TLD = { fontSize: '80px', textTransform: 'none' } satisfies CSSProperties

const FOOT = {
  borderTopColor: color.ink,
  borderTopStyle: 'solid',
  borderTopWidth: FRAME_WIDTH,
  display: 'flex',
  flex: '0 0 28px',
} satisfies CSSProperties

export function BrandCard({ kicker }: BrandCardProps) {
  return (
    <div data-brand-card="" style={CARD}>
      <Speckle grain="ink" />
      <div style={ROW}>
        <p style={KICKER}>{kicker}</p>
        <div style={NOTCH}>
          <p style={TITLE}>
            Salvage
            <br />
            Union<span style={TLD}>.io</span>
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
