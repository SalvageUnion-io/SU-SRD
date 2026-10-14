import type { CSSProperties } from 'react'
import { foregroundOn } from '../../design/contrast'
import { borderWidth, color, font, space, tracking, weight } from '../../design/tokens'
import { PRODUCT } from '../../product'
import { ChapterBand } from '../atoms/ChapterBand'
import { Speckle } from '../atoms/Speckle'
import { Stat } from '../atoms/Stat'
import { PENNANT_SHAPE, USER_MADE_TITLE } from '../referenceEntity/card/cardChrome'
import type { OgCardChip, OgCardProps, OgCardStat } from './ogCardText'
import {
  bandColor,
  footLineOf,
  OG_CARD_HEIGHT,
  OG_CARD_WIDTH,
  OG_GUTTER,
  ogCardLayout,
  ogCardPrintedTitle,
  ogCardTitle,
  REFERENCE_KINDS,
} from './ogCardText'

/**
 * OgCard — the link preview (origin boards PV1 and OgCard): a
 * 1200 × 630 picture of the page a link opens, built from the same parts as
 * that page. The chapter band with its speckle and the notched title
 * (`ChapterBand` at its `og` scale; nothing above the title, EDL E20), the
 * entity's one chip group beside it on the band, right-aligned on the title's
 * baseline as a show page's header chips are (E17: the page's own horizontal
 * `Stat` cells, the cost's pointy box last, extra rows stacking upward), and the Union bar's ink foot with the
 * mark and the address. The kind rides the foot line before the cite, as a
 * Page's foot names it (E9). Because it is assembled from the page's own parts
 * rather than drawn a second time, the preview cannot drift from the page; the
 * SRD screenshots it at build, ITUN on request.
 *
 * ## Six cards
 *
 * - `thing` — a reference thing you HAVE (chassis, system, equipment): its
 *   tone on the band, a solid frame, its chips and the page cite.
 * - `do` — a thing you DO (ability, action): the ink band (an ability's tier
 *   tone) with the tier numeral left of the name, its chips and cost, and the
 *   rules text (two lines at most).
 * - `sheet` — a player's pilot, mech or crawler. Built from canon, so solid;
 *   the byline names the player and the Game.
 * - `userMade` — a pattern or NPC a player made (ruleset §3.9): dashed frame,
 *   hatched band, dashed notch and the User-made stamp leading the chips; the
 *   byline is only "Made by [user]".
 * - `invite` — a Game invite: the Game's name, who mediates and the expiry.
 *   The caller never hands it the token, so it cannot print one.
 * - `private` — anything set to Only me. No name, no stats, no maker: a
 *   preview never shows more than the page would show a stranger.
 *
 * ## One line
 *
 * The notched title never wraps: it steps down from 120px to the 34px floor
 * (`ogTitleSize`), then ends in an ellipsis, so an unbounded player-typed name
 * cannot reach the chip row.
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

/**
 * The band: the notch on its foot, nothing above the title (EDL E20). It is
 * `OG_BAND_HEIGHT` tall, taller when the chips beside the title stack higher
 * (`ogCardLayout`).
 */
const BAND_SLOT = { flex: '0 0 auto', minHeight: 0 } satisfies CSSProperties

const CAPS = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.1,
  textTransform: 'uppercase',
} satisfies CSSProperties

const BODY = {
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  gap: space[20],
  minHeight: 0,
  padding: `${space[28]} ${OG_GUTTER}`,
} satisfies CSSProperties

/**
 * The foot line stands on the body's foot, a gutter over the Union bar, so
 * every card's cite sits on one baseline however many chip rows or lines of
 * rules text come before it.
 */
const LINE = {
  color: color.ink2,
  fontFamily: font.body,
  fontSize: '34px',
  fontWeight: weight.semibold,
  lineHeight: 1.2,
  margin: 0,
  marginTop: 'auto',
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

/** The cost, the book's pointy box (`ActivationCost`) at the preview's scale: ink on the paper. */
const PENNANT = {
  ...CAPS,
  backgroundColor: color.ink,
  clipPath: PENNANT_SHAPE,
  color: color.paper,
  fontSize: '44px',
  fontWeight: weight.extrabold,
  lineHeight: 1,
  padding: `${space[8]} ${space[48]} ${space[8]} ${space[12]}`,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

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
  padding: `0 ${OG_GUTTER}`,
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

/** The notch's baseline above the band's foot, as a share of the title's size. */
const NOTCH_BASELINE = 0.076

// ── Parts ─────────────────────────────────────────────────────────────────

/**
 * The chip group (E17): a user-made stamp first, the chips label first
 * (`TL | 1`, "Turn Action", `[Burn | 2]`), the cost's pointy box last.
 */
function Chips({
  stats,
  cost,
  userMade,
  width,
  baseline,
}: {
  stats: OgCardStat[]
  cost?: string | undefined
  userMade: boolean
  width: number
  baseline: string
}) {
  return (
    <div className="su-og-chips" style={{ paddingBottom: baseline, width }}>
      {userMade && (
        <span title={USER_MADE_TITLE} style={STAMP}>
          User-made
        </span>
      )}
      {stats.map((stat) => (
        <Stat
          key={`${stat.label}-${stat.value ?? ''}`}
          orientation="horizontal"
          label={stat.label}
          value={stat.value}
          size="full"
        />
      ))}
      {cost && <span style={PENNANT}>{cost}</span>}
    </div>
  )
}

function UnionFoot({
  reference,
  address,
  markSrc,
}: {
  reference: boolean
  address: string
  markSrc: string
}) {
  return (
    <div style={BAR}>
      <Speckle grain="paper" />
      <div style={LOCKUP}>
        <img src={markSrc} alt="" width={56} height={56} />
        <span style={WORDMARK}>{reference ? PRODUCT.wordmark : PRODUCT.name}</span>
      </div>
      <span style={ADDRESS}>{address}</span>
    </div>
  )
}

/**
 * `markSrc` is the SU mark's URL, the app's own copy (ITUN serves its files
 * under `/build/`, ADR-048); the root's by default.
 */
export function OgCard({
  markSrc = '/logos/su-cargo-dark.svg',
  ...props
}: OgCardProps & { markSrc?: string }) {
  const fill = bandColor(props)
  const ink = foregroundOn(fill, 'ink') === 'ink'
  const userMade = props.kind === 'userMade'
  const reference = REFERENCE_KINDS.has(props.kind)
  const title = ogCardTitle(props)
  const printed = ogCardPrintedTitle(props)
  const footLine = footLineOf(props)
  // An ability's numeral sits left of the name, on the band (EDL E12, its
  // page's `lead`); the name steps down to leave it room.
  const tier = props.kind === 'do' ? props.tier : undefined
  const stats = 'stats' in props ? props.stats : []
  const cost = 'cost' in props ? props.cost : undefined
  const chips: OgCardChip[] = [
    ...(userMade ? [{ kind: 'stamp', text: 'User-made' } as const] : []),
    ...stats.map((stat) => ({ kind: 'stat', label: stat.label, value: stat.value }) as const),
    ...(cost ? [{ kind: 'cost', text: cost } as const] : []),
  ]
  const layout = ogCardLayout(tier ? `${tier} ${printed}` : printed, chips)
  const titlePx = layout.titleSize
  const titleSize = `${titlePx}px`
  const chipGroup =
    chips.length > 0 ? (
      <Chips
        stats={stats}
        cost={cost}
        userMade={userMade}
        width={layout.chipsWidth}
        // Beside the title, on its baseline as a show page's header chips sit:
        // the face's descent less the half-leading of the notch's line.
        baseline={layout.chips === 'beside' ? `${Math.round(titlePx * NOTCH_BASELINE)}px` : '0px'}
      />
    ) : undefined

  return (
    <article
      aria-label={title}
      data-og-card={props.kind}
      style={{ ...CARD, borderStyle: userMade ? 'dashed' : 'solid' }}
    >
      <div style={{ ...BAND_SLOT, flexBasis: layout.bandHeight }}>
        <ChapterBand
          scale="og"
          fill={fill}
          grain={ink ? 'ink' : 'paper'}
          userMade={userMade}
          titleSize={titleSize}
          lead={tier ? <span style={{ fontSize: titleSize }}>{tier}</span> : undefined}
          aside={layout.chips === 'beside' ? chipGroup : undefined}
          corner={layout.chips === 'above' ? chipGroup : undefined}
        >
          {printed}
        </ChapterBand>
      </div>
      <div style={BODY}>
        {props.kind === 'do' && props.rules && <p style={PROSE}>{props.rules}</p>}
        {props.kind === 'invite' && <p style={PROSE}>{props.summary}</p>}
        {footLine && <p style={LINE}>{footLine}</p>}
      </div>
      <UnionFoot reference={reference} address={props.address} markSrc={markSrc} />
    </article>
  )
}
