import type { CSSProperties, ReactNode } from 'react'
import { foregroundOn } from '../../design/contrast'
import { borderWidth, color, font, space, tracking, weight } from '../../design/tokens'
import { ChapterBand } from '../chrome/ChapterBand'
import { Speckle } from '../chrome/Speckle'
import { PENNANT_SHAPE, USER_MADE_TITLE } from '../referenceEntity/card/cardChrome'
import type { OgCardProps, OgCardStat } from './ogCardText'
import {
  bandColor,
  bylineOf,
  OG_CARD_HEIGHT,
  OG_CARD_WIDTH,
  ogCardTitle,
  ogTitleSize,
  REFERENCE_KINDS,
} from './ogCardText'

/**
 * OgCard — the link preview (issue 1280, canvas boards PV1 and OgCard): a
 * 1200 × 630 picture of the page a link opens, built from the same parts as
 * that page. The chapter band with its speckle and the notched title
 * (`ChapterBand` at its `og` scale), framed stat boxes on the page ground, and
 * the Union bar's ink foot with the mark and the address. Because it is
 * assembled from the page's own parts rather than drawn a second time, the
 * preview cannot drift from the page; the SRD screenshots it at build, ITUN
 * on request.
 *
 * ## Six cards
 *
 * - `thing` — a reference thing you HAVE (chassis, system, equipment): its
 *   tone on the band, a solid frame, stat boxes and the page cite.
 * - `do` — a thing you DO (ability, action): the ink band with the tier
 *   numeral and the cost pennant, and the rules text (two lines at most).
 * - `sheet` — a player's pilot, mech or crawler. Built from canon, so solid;
 *   the byline names the player and the Game.
 * - `userMade` — a pattern or NPC a player made (ruleset §3.9): dashed frame,
 *   hatched band, dashed notch and the User-made stamp; the byline is only
 *   "Made by [user]".
 * - `invite` — a Game invite: the Game's name, who mediates and the expiry.
 *   The caller never hands it the token, so it cannot print one.
 * - `private` — anything set to Only me. No name, no stats, no maker: a
 *   preview never shows more than the page would show a stranger.
 *
 * ## The floor
 *
 * Discord draws the card about 400px wide, so nothing here is set under 34px
 * at source (ruleset §4.6: 34px at 1200 is 11px at 400).
 *
 * ## The foot rule
 *
 * Board PV1 draws the rule over the Union bar in rust. Rust means action and
 * only action (ruleset §3.1, `tokens/rust-allowlist`), and nothing on a
 * picture can be pressed, so the rule is ink here, as the Union bar's own
 * edge is.
 */

// ── Style objects ─────────────────────────────────────────────────────────

/** The frame: twice the entity card's 3px, so it reads as 2px at 400px wide. */
const FRAME_WIDTH = `calc(${borderWidth.entity} * 2)`
const GUTTER = `calc(${space[48]} + ${space[8]})`

const CARD = {
  backgroundColor: color.wkBg,
  borderColor: color.ink,
  borderWidth: FRAME_WIDTH,
  boxSizing: 'border-box',
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  height: OG_CARD_HEIGHT,
  overflow: 'hidden',
  position: 'relative',
  width: OG_CARD_WIDTH,
} satisfies CSSProperties

const BAND_SLOT = { flex: '0 0 294px', minHeight: 0 } satisfies CSSProperties

const EYEBROW = {
  alignItems: 'flex-start',
  display: 'flex',
  gap: space[24],
  justifyContent: 'space-between',
  width: '100%',
} satisfies CSSProperties

const CAPS = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.1,
  textTransform: 'uppercase',
} satisfies CSSProperties

const KICKER = { ...CAPS, fontSize: '36px', margin: 0 } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  gap: space[20],
  minHeight: 0,
  padding: `${space[28]} ${GUTTER} 0`,
} satisfies CSSProperties

const STATS = { display: 'flex', gap: space[14] } satisfies CSSProperties

const STAT = {
  alignItems: 'center',
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.entity,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '113px',
  minWidth: '166px',
  padding: `${space[6]} ${space[16]}`,
} satisfies CSSProperties

const STAT_LABEL = { ...CAPS, fontSize: '34px' } satisfies CSSProperties

const STAT_VALUE = {
  fontFamily: font.cond,
  fontSize: '56px',
  fontWeight: weight.extrabold,
  lineHeight: 1,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const LINE = {
  color: color.ink2,
  fontFamily: font.body,
  fontSize: '34px',
  fontWeight: weight.semibold,
  lineHeight: 1.2,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const PROSE = {
  color: color.ink,
  display: '-webkit-box',
  fontFamily: font.body,
  fontSize: '38px',
  fontWeight: weight.normal,
  lineHeight: 1.25,
  margin: 0,
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
} satisfies CSSProperties

const STAMP = {
  ...CAPS,
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderStyle: 'dashed',
  borderWidth: borderWidth.entity,
  color: color.ink,
  flex: 'none',
  fontSize: '36px',
  fontWeight: weight.extrabold,
  padding: `${space[2]} ${space[16]}`,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const NUMERAL = {
  ...CAPS,
  borderColor: color.paper,
  borderStyle: 'solid',
  borderWidth: borderWidth.entity,
  color: color.paper,
  fontSize: '44px',
  fontWeight: weight.extrabold,
  lineHeight: 1,
  padding: `${space[6]} ${space[14]}`,
} satisfies CSSProperties

const PENNANT = {
  ...CAPS,
  backgroundColor: color.paper,
  clipPath: PENNANT_SHAPE,
  color: color.ink,
  fontSize: '44px',
  fontWeight: weight.extrabold,
  lineHeight: 1,
  padding: `${space[8]} ${space[48]} ${space[8]} ${space[12]}`,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const STAMPS = { alignItems: 'center', display: 'flex', gap: space[12] } satisfies CSSProperties

// The Union bar's foot: the ink-deep ground with paper flecks, the mark, the
// wordmark and the address. Its top edge is the ink rule (see "The foot rule").
const BAR = {
  alignItems: 'center',
  backgroundColor: color.inkDeep,
  borderTopColor: color.ink,
  borderTopStyle: 'solid',
  borderTopWidth: FRAME_WIDTH,
  color: color.paper,
  display: 'flex',
  flex: '0 0 96px',
  gap: space[16],
  isolation: 'isolate',
  justifyContent: 'space-between',
  padding: `0 ${GUTTER}`,
  position: 'relative',
} satisfies CSSProperties

const LOCKUP = {
  alignItems: 'center',
  display: 'flex',
  flex: 'none',
  gap: space[16],
} satisfies CSSProperties

const WORDMARK = { ...CAPS, fontSize: '40px', fontWeight: weight.extrabold } satisfies CSSProperties

const ADDRESS = {
  fontFamily: font.cond,
  fontSize: '34px',
  fontWeight: weight.semibold,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

// ── Parts ─────────────────────────────────────────────────────────────────

function StatBoxes({ stats }: { stats: OgCardStat[] }) {
  if (stats.length === 0) return null
  return (
    <div style={STATS}>
      {stats.slice(0, 6).map((stat) => (
        <div key={stat.label} style={STAT}>
          <span style={STAT_LABEL}>{stat.label}</span>
          <span style={STAT_VALUE}>{stat.value}</span>
        </div>
      ))}
    </div>
  )
}

function UnionFoot({ reference, address }: { reference: boolean; address: string }) {
  return (
    <div style={BAR}>
      <Speckle grain="paper" />
      <div style={LOCKUP}>
        <img src="/logos/su-cargo-dark.svg" alt="" width={56} height={56} />
        <span style={WORDMARK}>{reference ? 'SalvageUnion.io' : 'ITUN'}</span>
      </div>
      <span style={ADDRESS}>{address}</span>
    </div>
  )
}

function Eyebrow({ kicker, ink, end }: { kicker: string; ink: boolean; end?: ReactNode }) {
  return (
    <div style={EYEBROW}>
      <p style={{ ...KICKER, color: ink ? color.ink : color.paper }}>{kicker}</p>
      {end}
    </div>
  )
}

export function OgCard(props: OgCardProps) {
  const fill = bandColor(props)
  const ink = foregroundOn(fill, 'ink') === 'ink'
  const userMade = props.kind === 'userMade'
  const reference = REFERENCE_KINDS.has(props.kind)
  const title = ogCardTitle(props)
  const kicker = props.kind === 'private' ? 'ITUN' : props.kicker
  const byline = bylineOf(props)

  const end =
    props.kind === 'userMade' ? (
      <span title={USER_MADE_TITLE} style={STAMP}>
        User-made
      </span>
    ) : props.kind === 'do' && (props.tier || props.cost) ? (
      <span style={STAMPS}>
        {props.tier && <span style={NUMERAL}>{props.tier}</span>}
        {props.cost && <span style={PENNANT}>{props.cost}</span>}
      </span>
    ) : undefined

  return (
    <article
      aria-label={title}
      data-og-card={props.kind}
      style={{ ...CARD, borderStyle: userMade ? 'dashed' : 'solid' }}
    >
      <div style={BAND_SLOT}>
        <ChapterBand
          scale="og"
          fill={fill}
          grain={ink ? 'ink' : 'paper'}
          userMade={userMade}
          titleSize={`${ogTitleSize(title)}px`}
          eyebrow={<Eyebrow kicker={kicker} ink={ink} end={end} />}
        >
          {userMade ? `“${title}”` : title}
        </ChapterBand>
      </div>
      <div style={BODY}>
        {'stats' in props && <StatBoxes stats={props.stats} />}
        {props.kind === 'do' && props.rules && <p style={PROSE}>{props.rules}</p>}
        {props.kind === 'invite' && <p style={PROSE}>{props.summary}</p>}
        {byline && <p style={LINE}>{byline}</p>}
      </div>
      <UnionFoot reference={reference} address={props.address} />
    </article>
  )
}
