import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import { foregroundOn } from '../../design/contrast'
import { borderWidth, color, font, space, weight } from '../../design/tokens'
import { MARK_SRC } from '../../lib/documentHead'
import { ActivationCost } from '../atoms/ActivationCost'
import { ChapterBand } from '../atoms/ChapterBand'
import { capsLabel } from '../atoms/capsLabel'
import { Speckle } from '../atoms/Speckle'
import { Stat } from '../atoms/Stat'
import { HOMEBREW } from '../referenceEntity/card/cardChrome'
import { HomebrewStamp } from '../referenceEntity/card/HomebrewStamp'
import type { OgCardChip, OgCardProps, OgCardStat } from './ogCardText'
import {
  bandColor,
  footOf,
  OG_CARD_HEIGHT,
  OG_CARD_WIDTH,
  OG_CHIP_GAP,
  OG_GUTTER,
  ogCardLayout,
  ogCardPrintedTitle,
  ogCardTitle,
  ogChipsLift,
  REFERENCE_KINDS,
} from './ogCardText'

/**
 * OgCard — the link preview (origin boards PV1 and OgCard): a
 * 1200 × 630 picture of the page a link opens, built from the same parts as
 * that page. The chapter band with its speckle and the notched title
 * (`ChapterBand` at its `og` scale; nothing above the title, EDL E20), the
 * entity's one chip group beside it on the band, right-aligned on the title's
 * capitals' middle as a show page's header chips are (E17: the page's own
 * horizontal `Stat` cells, the cost's pointy box last, extra rows stacking
 * upward). The
 * band's colour comes as far down the card as it can; under the notch only a
 * strip of the page ground, or the rules text. The foot is the page's footer:
 * the kind in caps and the cite on the band's colour (E9), then the Union
 * bar's ink row with the mark and the address. Because it is assembled from the page's own parts
 * rather than drawn a second time, the preview cannot drift from the page; the
 * SRD screenshots it at build, the app on request.
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
 *   hatched band, dashed notch and the HOMEBREW stamp leading the chips; the
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

/** The frame: a poster's (twice the entity card's), so it reads as 2px at 400px wide. */
const FRAME_WIDTH = borderWidth.poster

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
 * The band: the notch on its foot, nothing above the title (EDL E20). The
 * colour comes as far down the card as it can: the band takes every pixel the
 * body and the foot leave, and never less than `ogCardLayout`'s height for the
 * chips beside the title.
 */
const BAND_SLOT = { flex: '1 1 auto', minHeight: 0 } satisfies CSSProperties

const CAPS = {
  lineHeight: 1.1,
} satisfies CSSProperties
const CAPS_LABEL = capsLabel()

/** The page ground under the notch: the rules text, or a strip the notch stands on. */
const BODY = {
  flex: 'none',
  padding: `${space[24]} ${OG_GUTTER}`,
} satisfies CSSProperties

const STRIP = { ...BODY, paddingBlock: space[12] } satisfies CSSProperties

/**
 * The foot, as an entity page's footer is set: the band's colour with its
 * speckle, the kind in caps on the left and the cite on the right.
 */
const FOOT = {
  alignItems: 'baseline',
  display: 'flex',
  flex: 'none',
  gap: space[24],
  isolation: 'isolate',
  justifyContent: 'space-between',
  padding: `${space[20]} ${OG_GUTTER}`,
  position: 'relative',
} satisfies CSSProperties

const FOOT_KIND = {
  ...CAPS,
  flex: 'none',
  fontSize: '34px',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const FOOT_BYLINE = {
  fontFamily: font.body,
  fontSize: '34px',
  fontWeight: weight.normal,
  lineHeight: 1.2,
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textAlign: 'right',
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

/** The chips under a name too long to share its line: a left-aligned row on the page ground. */
const CHIPS_BELOW = { textAlign: 'start', textWrap: 'wrap' } satisfies CSSProperties

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
  // Under the notch the chips read as a line of text: left-aligned, wrapping down.
  // One gap wider: `.su-og-chips` cancels the leading gap of each row.
  const style = width > 0 ? { paddingBottom: baseline, width: width + OG_CHIP_GAP } : CHIPS_BELOW
  return (
    <div className="su-og-chips" style={style}>
      {/* The atoms, at the preview's scale: the stamp by `.su-og-chips`, as its Stat cells are. */}
      {userMade && <HomebrewStamp />}
      {stats.map((stat) => (
        <Stat
          key={`${stat.label}-${stat.value ?? ''}`}
          label={stat.label}
          value={stat.value}
          size="full"
        />
      ))}
      {cost && <ActivationCost cost={cost} currency="" size="og" />}
    </div>
  )
}

function UnionFoot({
  name,
  address,
  markSrc,
}: {
  /** The wordmark: the site's on a reference card, the area's on one of the app's. */
  name: string
  address: string
  markSrc: string
}) {
  return (
    <div style={BAR}>
      <Speckle grain="paper" />
      <div style={LOCKUP}>
        <img src={markSrc} alt="" width={56} height={56} />
        <span className={CAPS_LABEL} style={WORDMARK}>
          {name}
        </span>
      </div>
      <span style={ADDRESS}>{address}</span>
    </div>
  )
}

/**
 * `markSrc` is the SU mark's URL, the app's own copy (The app serves its files
 * under `/build/`, ADR-048); the root's by default.
 */
export function OgCard({ markSrc = MARK_SRC, ...props }: OgCardProps & { markSrc?: string }) {
  const fill = bandColor(props)
  const ink = foregroundOn(fill, 'ink') === 'ink'
  const userMade = props.kind === 'userMade'
  const reference = REFERENCE_KINDS.has(props.kind)
  const title = ogCardTitle(props)
  const printed = ogCardPrintedTitle(props)
  const foot = footOf(props)
  const prose =
    props.kind === 'do' ? props.rules : props.kind === 'invite' ? props.summary : undefined
  const footColor = ink ? color.ink : color.paper
  // An ability's numeral sits left of the name, on the band (EDL E12, its
  // page's `lead`); the name steps down to leave it room.
  const tier = props.kind === 'do' ? props.tier : undefined
  const stats = 'stats' in props ? props.stats : []
  const cost = 'cost' in props ? props.cost : undefined
  const chips: OgCardChip[] = [
    ...(userMade ? [{ kind: 'stamp', text: HOMEBREW } as const] : []),
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
        // Beside the title, the last row centred on its capitals' middle, as a
        // show page's header chips sit.
        baseline={layout.chips === 'beside' ? `${ogChipsLift(titlePx)}px` : '0px'}
      />
    ) : undefined

  return (
    <article
      aria-label={title}
      data-og-card={props.kind}
      style={{ ...CARD, borderStyle: userMade ? 'dashed' : 'solid' }}
    >
      <div style={{ ...BAND_SLOT, minHeight: layout.bandHeight }}>
        <ChapterBand
          scale="og"
          fill={fill}
          grain={ink ? 'ink' : 'paper'}
          userMade={userMade}
          titleSize={titleSize}
          lead={tier ? <span style={{ fontSize: titleSize }}>{tier}</span> : undefined}
          aside={layout.chips === 'beside' ? chipGroup : undefined}
        >
          {printed}
        </ChapterBand>
      </div>
      {/* With no rules text or chips the ground is only the strip the notch stands on. */}
      <div style={prose || layout.chips === 'below' ? BODY : STRIP}>
        {layout.chips === 'below' && chipGroup}
        {prose && <p style={PROSE}>{prose}</p>}
      </div>
      {(foot.kind || foot.byline) && (
        <div style={{ ...FOOT, backgroundColor: fill, color: footColor }}>
          <Speckle grain={ink ? 'ink' : 'paper'} />
          {foot.kind && (
            <span className={CAPS_LABEL} style={FOOT_KIND}>
              {foot.kind}
            </span>
          )}
          {foot.byline && <p style={FOOT_BYLINE}>{foot.byline}</p>}
        </div>
      )}
      <UnionFoot
        // An invite leads to a Game, which is Play's; every other app card is
        // something built (a shared sheet or pattern), which is Build's.
        name={reference ? PRODUCT.wordmark : props.kind === 'invite' ? PRODUCT.play : PRODUCT.build}
        address={props.address}
        markSrc={markSrc}
      />
    </article>
  )
}
