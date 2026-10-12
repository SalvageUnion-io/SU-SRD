/**
 * FrontDoor — ITUN's home for a visitor who is not signed in (board 09, issue 1255).
 *
 * Signed out, ITUN is read-only (ADR-034 as amended): there is nothing of the
 * visitor's to list, so `/` is the front door instead —
 *
 *  - the **"In The Union Now" chapter band**, with what ITUN is, the sign-in,
 *    a way into a Starter Set sheet, and the one line about invite links (a
 *    Game is joined from a link, never a typed code);
 *  - **how it works**, in three steps: Create a Pilot → Create a Mech → Join
 *    or make a Crawler. Playing a Game happens from the Crawler, so it is not a
 *    step of its own;
 *  - **the Starter Set** as `StarterCard`s (the card `/starter` lists them
 *    with), one column per kind, each opening its read-only sheet, with one
 *    Leyline Press credit for the section rather than a stamp on every card.
 *
 * Style objects and tokens only (tailwind-removal.md).
 */

import { buttonVariants, ChapterBand, Slab, tokens } from 'component-lib'
import { STARTER_PILOTS } from 'itun-domain/starterSet/starterSet'
import type { CSSProperties } from 'react'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/copyStarter'
import { SignInControl } from '../account/SignInControl'
import { AppLink } from '../shared/AppLink'
import { StarterCard } from '../starterSet/StarterCard'
import { starterShelves } from '../starterSet/starterShelves'

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

const NOTE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: `${tokens.space[16]} 0 0`,
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

const STEP = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  paddingBottom: tokens.space[20],
} satisfies CSSProperties

/** The step's ink band, square on the left and rounded off on the right. */
const STEP_BAND = {
  alignItems: 'center',
  backgroundColor: tokens.color.ink,
  borderEndEndRadius: tokens.radius.full,
  borderStartEndRadius: tokens.radius.full,
  color: tokens.color.paper,
  display: 'flex',
  gap: tokens.space[10],
  margin: `${tokens.space[12]} ${tokens.space[24]} ${tokens.space[16]} 0`,
  padding: `${tokens.space[8]} ${tokens.space[16]} ${tokens.space[8]} ${tokens.space[12]}`,
} satisfies CSSProperties

const STEP_NUMBER = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.displayLg,
  fontWeight: tokens.weight.extrabold,
  lineHeight: 1,
} satisfies CSSProperties

const STEP_TITLE = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.title,
  fontWeight: tokens.weight.bold,
  lineHeight: 1.1,
  margin: 0,
} satisfies CSSProperties

const STEP_BODY = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  lineHeight: 1.55,
  margin: 0,
  paddingInline: tokens.space[16],
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

const STEPS = [
  {
    title: 'Create a Pilot',
    body: 'Pick a class and your first ability, then add a keepsake, motto and background.',
  },
  {
    title: 'Create a Mech',
    body: 'Choose a chassis and pattern, then fill its system and module slots.',
  },
  {
    title: 'Join or make a Crawler',
    body: 'Start a crew’s Union Crawler and send an invite link, or open one a crewmate sent you. Your pilot plays from it, and the Dashboard handles heat, damage and the change log at the table.',
  },
]

export function FrontDoor() {
  const shelves = starterShelves()
  const firstSheet = STARTER_PILOTS[0]

  return (
    <main style={PAGE}>
      <ChapterBand
        measure={MEASURE}
        eyebrow={<span style={KICKER}>ITUN · Beta · Your crew, from the Workshop Manual</span>}
      >
        In The Union Now
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
          <p style={NOTE}>
            Got an invite link from your Mediator? Open it and sign in to join that Game. There are
            no codes to type.
          </p>
        </section>

        <section aria-labelledby="front-door-how" style={SECTION}>
          <Slab label="How it works" id="front-door-how" as="h2" variant="solid" />
          <ol style={GRID}>
            {STEPS.map((step, index) => (
              <li key={step.title} style={STEP}>
                <div style={STEP_BAND}>
                  <span aria-hidden="true" style={STEP_NUMBER}>
                    {index + 1}
                  </span>
                  <h3 style={STEP_TITLE}>{step.title}</h3>
                </div>
                <p style={STEP_BODY}>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

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
