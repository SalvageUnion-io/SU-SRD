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
 *  - **the Starter Set** as clickable rows, one column per kind, each row
 *    opening its read-only sheet, with one Leyline Press credit for the
 *    section rather than a stamp on every row.
 *
 * Style objects and tokens only (tailwind-removal.md).
 */

import { buttonVariants, ChapterBand, Slab, tokens } from 'component-lib'
import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { resolveClassName } from '../../lib/classRef'
import type { StarterKind } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/copyStarter'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from '../../lib/starterSet/starterSet'
import { SignInControl } from '../account/SignInControl'
import { AppLink } from '../shared/AppLink'
import { crawlerStats, mechChassisStats } from './rowStats'

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
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
} satisfies CSSProperties

const SHELF_HEAD = {
  alignItems: 'baseline',
  borderBottomColor: tokens.color.ink20,
  borderBottomStyle: 'solid',
  borderBottomWidth: tokens.borderWidth.hairline,
  display: 'flex',
  justifyContent: 'space-between',
  padding: `${tokens.space[12]} ${tokens.space[14]}`,
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

const ROWS = { listStyle: 'none', margin: 0, padding: 0 } satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  borderTopColor: tokens.color.ink15,
  borderTopStyle: 'solid',
  borderTopWidth: tokens.borderWidth.hairline,
  color: tokens.color.ink,
  display: 'flex',
  gap: tokens.space[12],
  minHeight: '48px',
  padding: `0 ${tokens.space[14]}`,
  textDecoration: 'none',
} satisfies CSSProperties

const ROW_NAME = {
  flex: '1 1 auto',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.readout,
  fontWeight: tokens.weight.bold,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const ROW_DETAIL = {
  color: tokens.color.ink75,
  flexShrink: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
} satisfies CSSProperties

/** The tone rule along a shelf's top: the kind, seen before it is read. */
const TONE: Record<StarterKind, string> = {
  pilot: tokens.color.pilot,
  mech: tokens.color.mech,
  crawler: tokens.color.crawler,
}

type StarterRow = { id: string; name: string; detail: string }

type StarterShelf = { kind: StarterKind; title: string; rows: StarterRow[] }

/** "Scrapper · TL 1" — the facts a row is told apart by. */
function mechDetail(chassisRef: string): string {
  const stats = mechChassisStats(chassisRef) ?? []
  const chassis = stats.find((s) => s.label === 'Chassis')?.value
  const tl = stats.find((s) => s.label === 'TL')?.value
  return [chassis, tl === undefined ? undefined : `TL ${tl}`].filter(Boolean).join(' · ')
}

function crawlerDetail(techLevel: string, bays: number): string {
  const stats = crawlerStats(techLevel, bays)
  const tl = stats.find((s) => s.label === 'TL')?.value
  return [tl === undefined ? undefined : `TL ${tl}`, `${bays} bays`].filter(Boolean).join(' · ')
}

/** The Starter Set's three shelves, built from the static seed (no reference reads but names). */
function starterShelves(): StarterShelf[] {
  return [
    {
      kind: 'pilot',
      title: 'Pilots',
      rows: STARTER_PILOTS.map((p) => ({
        id: p.id,
        name: p.name,
        detail: resolveClassName(p.classRef),
      })),
    },
    {
      kind: 'mech',
      title: 'Mechs',
      rows: STARTER_MECHS.map((m) => ({
        id: m.id,
        name: m.name,
        detail: mechDetail(m.chassisRef),
      })),
    },
    {
      kind: 'crawler',
      title: STARTER_CRAWLERS.length === 1 ? 'Crawler' : 'Crawlers',
      rows: STARTER_CRAWLERS.map((c) => ({
        id: c.id,
        name: c.name,
        detail: crawlerDetail(c.techLevel, c.crawlerBays?.length ?? 0),
      })),
    },
  ]
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
                style={{
                  ...SHELF,
                  borderTopColor: TONE[shelf.kind],
                  borderTopWidth: tokens.space[10],
                }}
              >
                <div style={SHELF_HEAD}>
                  <h3 style={SHELF_TITLE}>{shelf.title}</h3>
                  <span style={SHELF_COUNT}>{shelf.rows.length}</span>
                </div>
                <ul style={ROWS}>
                  {shelf.rows.map((row) => (
                    <li key={row.id}>
                      <AppLink
                        href={`/starter/${shelf.kind}/${row.id}`}
                        className="su-focus-ring"
                        style={ROW}
                        aria-label={`Read ${row.name}`}
                      >
                        <span style={ROW_NAME}>{row.name}</span>
                        <span style={ROW_DETAIL}>{row.detail}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </AppLink>
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
