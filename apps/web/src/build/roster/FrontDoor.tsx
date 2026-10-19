/**
 * FrontDoor — Build's home for a visitor who is not signed in (board 09).
 *
 * Signed out, the app is read-only (ADR-034 as amended): there is nothing of the
 * visitor's to list, so `/` is the front door instead —
 *
 *  - **Build's name** on its chapter band (`PRODUCT.build`, the Training Bay)
 *    in Build's pilot-orange tone,
 *    under `PRODUCT.descriptor`, with the legacy tagline quoted beside the
 *    name (under it on a phone). No intro band under it (owner, 2026-10-14):
 *    signing in is the header's, and the Starter Set is the header's tab and
 *    this page's own section;
 *  - **Start here**, the onboarding the SRD's home shows too (`StartHere`):
 *    Create a Pilot → Create a Mech → Join or make a Crawler. Playing a Game
 *    happens from the Crawler, so it is not a step of its own;
 *  - **the Starter Set** as `StarterCard`s (the card `/starter` lists them
 *    with), one column per kind, each opening its read-only sheet, with one
 *    Leyline Press credit for the section rather than a stamp on every card.
 *
 * Style objects and tokens only (ADR-046).
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import { SCRIPT_FONT } from '../../lib/scriptFont'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { ChapterBand, Slab, Stack, StartHere, tokens } from '../../components/index'
import { StarterSetGrid } from '../starterSet/StarterSetGrid'
import { capsLabel } from '../../components/atoms/capsLabel'

/** The width the band's notch and the content under it share. */
const MEASURE = '75rem'

/** The page: the band runs full-bleed, so this is not a padded `PageShell`. */
const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100vh',
} satisfies CSSProperties

// Its side padding and centring are `.su-page-body`'s: the band's row padding.
const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[40],
  maxWidth: MEASURE,
} satisfies CSSProperties

/** The kicker and the tagline's credit: brand caps, the eyebrow's tracking. */
const KICKER_CAPS = capsLabel({ size: 'caption', tracking: 'eyebrow' })

/** The legacy tagline, quoted in a hand. Its colour and alignment are `screens.css`'s
 *  (`.su-front-door__quote`): ink, set right on the band and left under it. */
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

const CREDIT = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  margin: 0,
} satisfies CSSProperties

export function FrontDoor() {
  return (
    <main style={PAGE}>
      <ChapterBand
        tone="build"
        measure={MEASURE}
        eyebrow={<span className={KICKER_CAPS}>{PRODUCT.descriptor}</span>}
        asideAt="notch"
        aside={
          <figure className="su-front-door__quote">
            <blockquote style={QUOTE}>“{PRODUCT.tagline}”</blockquote>
            <figcaption className={KICKER_CAPS} style={QUOTE_BY}>— {PRODUCT.taglineBy}</figcaption>
          </figure>
        }
      >
        {PRODUCT.build}
      </ChapterBand>

      <div className="su-page-body" style={{ ...COLUMN, paddingBlock: tokens.space[32] }}>
        <StartHere id="front-door-start" />

        <Stack as="section" gap={16} aria-labelledby="front-door-starter">
          <Slab label="Starter Set" id="front-door-starter" as="h2" />
          <p style={CREDIT}>
            The pre-generated crew of <em>{STARTER_SET_ADVENTURE}</em>, by {STARTER_SET_PUBLISHER}.
            Open any sheet to read it; sign in to copy one.
          </p>
          <StarterSetGrid />
        </Stack>
      </div>
    </main>
  )
}
