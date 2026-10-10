/**
 * ShelfPill — an item on a shelf as one line (Shelves, board S1): the entity
 * card's shortform anatomy (`ReferenceEntityCard` at `size="small"
 * extent="head"`) for things a player keeps. A tone fill in the unit's colour,
 * an ink stamp with its kind and defining fact ("PILOT · ENGINEER"), its name,
 * and one reading (`HP 8/10`), framed in ink; the whole line opens it.
 *
 * Why not the card itself: the card renders reference data, and a pilot, mech
 * or crawler on a shelf is the player's own build, which no reference record
 * describes. This is the same anatomy at the same scale — the sheet's linked
 * units (`LinkedUnitLink`) make the same call one rung up.
 *
 * **User-made** (ruleset §3.9): a pattern or an NPC is something a player made
 * that could pass for the book, so its frame is dashed and its name is quoted
 * as a pattern's is. Pilots, mechs and crawlers built from canon stay solid.
 */

import { Stat, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { ShelfReading } from '../../lib/shelves/shelfItems'
import { AppLink } from '../shared/AppLink'

export type ShelfKind = 'pilot' | 'mech' | 'crawler' | 'pattern' | 'npc'

/**
 * The fill and the text it carries (ruleset §3.8, ink on colour). Crawler pink
 * carries neither ink nor paper at 4.5:1, so a crawler takes the deeper band
 * pink with paper; an NPC takes the adversary brown with paper. A pattern is a
 * mech's, in mech green.
 */
const TONE: Record<ShelfKind, { fill: string; text: string }> = {
  pilot: { fill: tokens.color.pilot, text: tokens.color.ink },
  mech: { fill: tokens.color.mech, text: tokens.color.ink },
  crawler: { fill: tokens.color.crawlerBand, text: tokens.color.paper },
  pattern: { fill: tokens.color.mech, text: tokens.color.ink },
  npc: { fill: tokens.color.adversary, text: tokens.color.paper },
}

const PILL = {
  alignItems: 'center',
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.card,
  borderWidth: tokens.borderWidth.pill,
  display: 'inline-flex',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  gap: tokens.space[6],
  letterSpacing: tokens.tracking.capsTight,
  lineHeight: 1.2,
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
  padding: `3px ${tokens.space[6]} 3px ${tokens.space[4]}`,
  textDecoration: 'none',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const STAMP = {
  backgroundColor: tokens.color.ink,
  color: tokens.color.paper,
  flex: 'none',
  fontSize: tokens.fontSize.badge,
  letterSpacing: tokens.tracking.capsSnug,
  padding: `1px ${tokens.space[4]}`,
} satisfies CSSProperties

const NAME = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} satisfies CSSProperties

const READING = { flex: 'none' } satisfies CSSProperties

/** Clip to nothing without leaving the accessibility tree. */
const VISUALLY_HIDDEN = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} satisfies CSSProperties

type ShelfPillProps = {
  kind: ShelfKind
  /** The stamp: "Pilot · Engineer". */
  kicker: string
  name: string
  reading?: ShelfReading
  /** Where the line opens; a line with nowhere to open is not a link. */
  href?: string
  /** A pattern or an NPC: dashed, its name quoted (ruleset §3.9). */
  userMade?: boolean
}

export function ShelfPill({ kind, kicker, name, reading, href, userMade = false }: ShelfPillProps) {
  const tone = TONE[kind]
  const style = {
    ...PILL,
    backgroundColor: tone.fill,
    borderStyle: userMade ? 'dashed' : 'solid',
    color: tone.text,
  } satisfies CSSProperties
  const body = (
    <>
      <span style={STAMP}>{kicker}</span>
      <span style={NAME}>{userMade ? `“${name}”` : name}</span>
      {/* The dashes are the only visual cue, so the accessible name says it. */}
      {userMade && <span style={VISUALLY_HIDDEN}>, user-made</span>}
      {reading && (
        <span style={READING}>
          <Stat orientation="horizontal" label={reading.label} value={reading.value} size="mini" />
        </span>
      )}
    </>
  )
  if (href === undefined) {
    return (
      <span data-user-made={userMade || undefined} style={style}>
        {body}
      </span>
    )
  }
  return (
    <AppLink
      href={href}
      className="su-focus-ring"
      data-user-made={userMade || undefined}
      style={style}
    >
      {body}
    </AppLink>
  )
}
