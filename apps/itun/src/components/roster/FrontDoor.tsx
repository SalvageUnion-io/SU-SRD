/**
 * FrontDoor — ITUN's home for a visitor who is not signed in (board 09).
 *
 * Signed out, ITUN is read-only (ADR-034 as amended): there is nothing of the
 * visitor's to list, so `/` is the front door instead —
 *
 *  - the **product-name chapter band** (`PRODUCT.name`) in the cantina tone,
 *    under `PRODUCT.descriptor`, with the legacy tagline quoted beside the
 *    name (under it on a phone), then what it is, the sign-in,
 *    a way into a Starter Set sheet, and the one line about invite links (a
 *    Game is joined from a link, never a typed code);
 *  - **Start here**, the onboarding the SRD's home shows too (`StartHere`):
 *    Create a Pilot → Create a Mech → Join or make a Crawler. Playing a Game
 *    happens from the Crawler, so it is not a step of its own;
 *  - **the Starter Set** as `StarterCard`s (the card `/starter` lists them
 *    with), one column per kind, each opening its read-only sheet, with one
 *    Leyline Press credit for the section rather than a stamp on every card.
 *
 * Style objects and tokens only (ADR-046).
 */

import { buttonVariants, ChapterBand, Slab, StartHere, tokens } from 'component-lib'
import { PRODUCT } from 'component-lib/product'
import { STARTER_PILOTS } from 'itun-domain/starterSet/starterSet'
import type { CSSProperties } from 'react'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/copyStarter'
import { SignInControl } from '../account/SignInControl'
import { AppLink } from '../shared/AppLink'
import { StarterCard } from '../starterSet/StarterCard'
import { starterShelves } from '../starterSet/starterShelves.model'

/** The width the band's notch and the content under it share. */
const MEASURE = '75rem'

/** The page: the band runs full-bleed, so this is not a padded `PageShell`. */
const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100vh',
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[40],
  marginInline: 'auto',
  maxWidth: MEASURE,
  paddingInline: tokens.space[16],
  width: '100%',
} satisfies CSSProperties

const KICKER = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.eyebrow,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The legacy tagline, quoted in a hand. Its colour and alignment are `screens.css`'s
 *  (`.front-door__quote`): paper on the band, the deep crawler pink under it. */
/** The quote's hand: Caveat, self-hosted beside Barlow (`routes/__root.tsx`),
 *  so it renders offline and under the CSP like the rest of the type. */
const SCRIPT = "'Caveat', cursive"

const QUOTE = {
  fontFamily: SCRIPT,
  fontSize: tokens.fontSize.hero,
  fontWeight: tokens.weight.semibold,
  lineHeight: 1,
  margin: 0,
} satisfies CSSProperties

const QUOTE_BY = {
  ...KICKER,
  color: tokens.color.ink,
  fontStyle: 'italic',
  margin: `${tokens.space[4]} 0 0`,
} satisfies CSSProperties

const INTRO = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[24],
  justifyContent: 'space-between',
} satisfies CSSProperties

const LEDE = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.readout,
  lineHeight: 1.6,
  margin: 0,
  maxWidth: '40rem',
} satisfies CSSProperties

const ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

/** Cards that fit as many ~18rem columns as there is room for; one on a phone. */
const GRID = {
  alignItems: 'start',
  display: 'grid',
  gap: tokens.space[16],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const CREDIT = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  margin: 0,
} satisfies CSSProperties

const SHELF = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[10],
} satisfies CSSProperties

/** The shelf's head over a rule in the kind's tone: the kind, seen before it is read. */
const SHELF_HEAD = {
  alignItems: 'baseline',
  borderBottomStyle: 'solid',
  borderBottomWidth: tokens.space[6],
  display: 'flex',
  justifyContent: 'space-between',
  paddingBottom: tokens.space[4],
} satisfies CSSProperties

const SHELF_TITLE = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.title,
  fontWeight: tokens.weight.bold,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

const SHELF_COUNT = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.readout,
  fontWeight: tokens.weight.bold,
} satisfies CSSProperties

const CARDS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[10],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const TONE: Record<StarterKind, string> = {
  pilot: tokens.color.pilot,
  mech: tokens.color.mech,
  crawler: tokens.color.crawler,
}

export function FrontDoor() {
  const shelves = starterShelves()
  const firstSheet = STARTER_PILOTS[0]

  return (
    <main style={PAGE}>
      <ChapterBand
        tone="cantina"
        measure={MEASURE}
        eyebrow={<span style={KICKER}>{PRODUCT.descriptor}</span>}
        asideAt="notch"
        aside={
          <figure className="front-door__quote">
            <blockquote style={QUOTE}>“{PRODUCT.tagline}”</blockquote>
            <figcaption style={QUOTE_BY}>— {PRODUCT.taglineBy}</figcaption>
          </figure>
        }
      >
        {PRODUCT.name}
      </ChapterBand>

      <div style={{ ...COLUMN, paddingBlock: tokens.space[32] }}>
        <section aria-label="Welcome">
          <div style={INTRO}>
            <p style={LEDE}>
              Build your pilots, mechs and Union Crawler straight from the Workshop Manual.
              Everything saves to your account and is ready to bring to a Game.
            </p>
            <div style={ACTIONS}>
              <SignInControl label="Sign in to build" size="full" />
              {firstSheet && (
                <AppLink
                  href={`/starter/pilot/${firstSheet.id}`}
                  className={buttonVariants({ variant: 'default', size: 'full' })}
                >
                  Read a Starter Set sheet
                </AppLink>
              )}
            </div>
          </div>
        </section>

        <StartHere id="front-door-start" />

        <section aria-labelledby="front-door-starter" style={SECTION}>
          <Slab label="Starter Set" id="front-door-starter" as="h2" variant="solid" />
          <p style={CREDIT}>
            The pre-generated crew of <em>{STARTER_SET_ADVENTURE}</em>, by {STARTER_SET_PUBLISHER}.
            Open any sheet to read it; sign in to copy one.
          </p>
          <div style={GRID}>
            {shelves.map((shelf) => (
              <section
                key={shelf.kind}
                aria-label={`Starter Set ${shelf.title.toLowerCase()}`}
                style={SHELF}
              >
                <div style={{ ...SHELF_HEAD, borderBottomColor: TONE[shelf.kind] }}>
                  <h3 style={SHELF_TITLE}>{shelf.title}</h3>
                  <span style={SHELF_COUNT}>{shelf.builds.length}</span>
                </div>
                <ul style={CARDS}>
                  {shelf.builds.map((build) => (
                    <li key={build.id}>
                      <StarterCard kind={shelf.kind} build={build} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
