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
  fontWeight: tokens.weight.semibold,
  lineHeight: 1,
  margin: 0,
} satisfies CSSProperties

const QUOTE_BY = {
  color: tokens.color.ink,
  fontStyle: 'italic',
  margin: `${tokens.space[4]} 0 0`,
} satisfies CSSProperties

/**
 * Tagline — the legacy tagline (`PRODUCT.tagline`) credited to
 * `PRODUCT.taglineBy`: every landing page says it. On a chapter band's aside
 * (the Reference, the Training Bay, the Games, each chapter's page) it is
 * quoted in a hand; `plain` sets it in the display face with no ground (the
 * home, over its art). Colour and alignment are `.su-tagline`'s (`shared.css`).
 */
export function Tagline({ plain = false }: { plain?: boolean }) {
  return (
    <figure className={plain ? 'su-tagline su-tagline--plain' : 'su-tagline'}>
      <blockquote style={plain ? undefined : QUOTE}>“{PRODUCT.tagline}”</blockquote>
      <figcaption className={CREDIT_CAPS} style={plain ? undefined : QUOTE_BY}>
        — {PRODUCT.taglineBy}
      </figcaption>
    </figure>
  )
}
