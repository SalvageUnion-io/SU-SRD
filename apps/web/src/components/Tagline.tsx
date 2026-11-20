import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import * as tokens from '../design/tokens'
import { SCRIPT_FONT } from '../lib/scriptFont'
import { capsLabel } from './atoms/capsLabel'

/** The credit: brand caps, the eyebrow's tracking. */
const CREDIT_CAPS = capsLabel({ size: 'caption', tracking: 'eyebrow' })

/** The line, quoted in a hand. */
const QUOTE = {
  fontFamily: SCRIPT_FONT,
  fontSize: tokens.fontSize.hero,
  fontWeight: tokens.weight.bold,
  lineHeight: 1,
  margin: 0,
} satisfies CSSProperties

const QUOTE_BY = {
  fontStyle: 'italic',
  fontWeight: tokens.weight.bold,
  // Flush under the quote: the two boxes touch, their widths the step between.
  margin: 0,
} satisfies CSSProperties

/**
 * Tagline — the legacy tagline (`PRODUCT.tagline`) quoted in a hand and
 * credited to `PRODUCT.taglineBy`: every landing page says it, beside its
 * title (a chapter band's aside, the home's paper plate beside its name).
 * Its colour and alignment are `.su-tagline`'s (`shared.css`).
 */
export function Tagline() {
  return (
    <figure className="su-tagline">
      <blockquote style={QUOTE}>“{PRODUCT.tagline}”</blockquote>
      <figcaption className={CREDIT_CAPS} style={QUOTE_BY}>
        — {PRODUCT.taglineBy}
      </figcaption>
    </figure>
  )
}
