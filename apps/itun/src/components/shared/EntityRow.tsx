import { Badge, Button, buttonVariants, STAMP_SEAM, Stat } from 'component-lib'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import type { LucideIcon } from 'lucide-react'
import { Bot, Trash2, Unlink, UserRound, Users, Warehouse } from 'lucide-react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Fragment } from 'react'

/**
 * EntityRow — a header-only clickable listing ROW: the compact, one-line
 * translation of a `Card` for roster / index surfaces.
 *
 * Anatomy — the CARD's, compressed. A row is built from the same bands an
 * entity card is, in the same order, at the same frame weight
 * (`--bw-entity`):
 *
 *                    ╔═══════╗  ← `seal`, riding the top border (STAMP_SEAM)
 *   ┌────────────────╨───────╨─────────┐
 *   │ ▸ HEADER BAND — solid ontology tone (pilot → orange, mech → green,
 *   │   crawler → pink, game → blue, the `--color-sheet-*` tokens), carrying
 *   │   the TITLE on the left and the row's `stats` on the right. What the
 *   │   thing IS, and how it is doing. The title follows the entity card's own
 *   │   rule (`EntityCardHeader`): ink text directly on the tone, no
 *   │   ink block behind it, at the size ladder's `small` rung.
 *   │ ▸ BODY — paper. Cross-links, and the trailing View / Unassign / Delete
 *   │   controls.
 *   │   Where you GO and what you DO.
 *   └──────────────────────────────────┘
 *
 * EVERY `label | value` fact lives in the band — the class and callsign as much
 * as SP and Heat, because a stat is a stat whether its value is a number or a
 * name. Splitting them across two registers meant `CLASS | Salvager` and
 * `SP | 12` were the same kind of statement rendered two different ways in two
 * different places. It also means a column of forty rows can be scanned down
 * one edge without the eye crossing the buttons.
 *
 * A card states its kind in a band across the top and puts its content on
 * paper, so a row does too — which also means every chip, stat
 * and button on a row sits on ONE ground instead of four faintly different
 * ones.
 *
 * Neither trailing action is the rust action colour — a row navigates and
 * removes, it never performs a true game action.
 *
 * **Every piece of text on the row is a badge**: the name is a stamp, the
 * class/role is a toned badge, stats render through `Stat`, and the caption is
 * a row of quiet chips. Nothing on a row is loose prose, so the eye reads one
 * vocabulary down a column of forty of them.
 *
 * Data-source agnostic: View renders `linkAs` (a plain `<a>` by default) styled
 * with `buttonVariants`, so the primitive works with any router or none — an
 * app with client-side routing injects its own Link rather than the row taking
 * a router dependency.
 *
 * Styling: geometry and type are the style objects below, over component-lib's
 * tokens. The two rules a style object cannot express — the empty foot's
 * child-stretch and the Delete button's colour, which must beat the ghost
 * variant's hover fill — live in `styles/entityRow.css`.
 */

/**
 * `game` is the shared table (ADR-030), not a game-data entity — it lists
 * alongside the three player entities because it is another thing you own and
 * open, and it carries its own tone so a Game row never reads as a crawler row.
 */
export type EntityRowType = 'pilot' | 'mech' | 'crawler' | 'game' | 'npc'

/** A single `label | value` stat rendered in the subheader as a horizontal Stat. */
export type EntityRowStat = {
  label: string | number
  value: string | number
}

/** The filled row: a linked player entity. */
type FilledEntityRowProps = {
  /** Entity ontology driving the header band's tone. */
  entityType: EntityRowType
  /** Filled is the default; omit or pass `false`. */
  empty?: false
  /** Entity name rendered in the black pseudoheader name tab. */
  name: string
  /**
   * The stats carried in the HEADER BAND, opposite the title. Each renders
   * through the canonical Stat (horizontal `label | value` mode) — never
   * hand-assembled text (see the stats-render-through-Stat law, ruleset §3).
   *
   * This is the row's PRIMARY register: what a reader scans a column of forty
   * rows for. Keep it short. A band asked to carry six cells stops being a
   * scannable edge and becomes a queue — put the rest in `bodyStats`.
   */
  stats?: EntityRowStat[]
  /**
   * The SECONDARY stats, rendered in the body beside the controls.
   *
   * Same cell, same primitive, lower billing — for facts that belong to the row
   * but are not what you scan it for. A Game states what the table IS in the
   * band (its crawler, its pilots, its mechs) and your standing at it down here
   * (your role, the member count, the template it came from).
   *
   * The split is the point. Everything was briefly in the band, which made the
   * one line a reader is meant to scan the longest line on the row.
   */
  bodyStats?: EntityRowStat[]
  /**
   * Class/role label(s) beside the stats — rendered as ontology-toned Badges
   * (pilot → orange, mech → green, crawler → pink, game → blue), never plain
   * prose.
   *
   * Pass an ARRAY to render several badges; a Game row carries three (its
   * crawler, its pilot count, its mech count). A single node stays a single
   * badge, which is what every pre-existing caller passes.
   */
  meta?: ReactNode | ReactNode[]
  /**
   * Body content beneath the band — nodes, rendered as given.
   *
   * This is how a CROSS-LINK arrives: only the app can build its own router
   * link, so it hands over an anchor wrapping its own `Stat`. Bare strings
   * render as quiet chips, for a value with genuinely no name to give it.
   *
   * Anything that is a `label | value` FACT belongs in `stats`, in the band —
   * not here. That is where the class, the callsign and the chassis went: a
   * stat is a stat whether its value is a number or a name, and splitting them
   * across two registers meant `CLASS | Salvager` and `SP | 12` were the same
   * kind of statement rendered two different ways in two different places.
   */
  metaLine?: ReactNode | ReactNode[]
  /**
   * A stamp pinned to the row's TOP-RIGHT corner — the mark applied ON the
   * record about its status, as distinct from `actions` (things you do to it)
   * and `meta` (what it is).
   *
   * A slot rather than a typed prop for the same reason `actions` is one: what
   * a row is stamped with belongs to the surface listing it. The Game roster
   * stamps ownership here (`UNCLAIMED` / `YOU` / a crewmate's name, ADR-030
   * §6); a personal roster stamps nothing at all.
   *
   * It is pinned to the header band's top-right corner and taken out of the
   * flow, so nothing on the row can push it elsewhere; the band reserves the
   * width for it, which is what stops a long name sliding underneath.
   */
  seal?: ReactNode
  /**
   * Destination for the View link. **Omit when there is nothing to open.**
   *
   * A row is not always a door. A shared roster lists entities the viewer can
   * see but has no sheet for — a crewmate's pilot, a pre-generated character
   * nobody has picked up yet — and rendering a View link that leads somewhere
   * empty (or worse, somewhere they cannot legitimately edit) would be the
   * dead end the row exists to describe. Without it, no link renders.
   */
  sheetHref?: string
  /**
   * Element the View link renders as (default `'a'`). Pass an app's router Link
   * to get client-side navigation; it receives `href` and `className`.
   */
  linkAs?: ElementType
  /** Fired when the ghost trash Delete button is pressed. Omit to hide the
   * Delete button entirely (e.g. read-only poster surfaces). */
  onDeleteClick?: () => void
  /**
   * Fired when the Unassign button is pressed. Omit to hide it.
   *
   * For a row standing in a SLOT — a pilot's assigned mech, a crawler's crew —
   * where the verb removes the assignment and leaves the entity alone. It is a
   * labelled text button, not the trash glyph, because the two must not look
   * alike: a player who learns the trash as "take this mech off my pilot" and
   * then meets it on a roster row deletes the mech.
   */
  onUnassignClick?: () => void
  /**
   * Extra trailing controls, rendered before View/Delete.
   *
   * Deliberately a slot rather than a set of named props: what a row can do
   * depends on the surface it is listed on, and the two known consumers already
   * disagree — a personal roster row navigates and deletes, while a shared
   * Game row may also be picked up, offered back to the crew, or launched into
   * the Dashboard. Teaching this primitive those verbs would push ownership,
   * accounts and routing into a package whose contract is to know about none of
   * them (the same reasoning as the owner chip's, ADR-030 §6).
   */
  actions?: ReactNode
}

/**
 * The EMPTY row: a dashed placeholder slot for an unfilled link (e.g. a pilot
 * with no assigned mech). Keeps the ontology header band + a black role tab, over
 * a helper message and optional create/link actions.
 */
type EmptyEntityRowProps = {
  entityType: EntityRowType
  empty: true
  /** Black role tab kept even when empty, e.g. 'ASSIGNED MECH'. */
  roleLabel: string
  /** Helper message, e.g. 'No mech in the bay — dock one to track it here.' */
  message: ReactNode
  /** Optional inline mock control (e.g. a hand-set Crawler Level stepper). */
  mock?: ReactNode
  /** Optional create/link CTAs, stretched across the dashed foot. */
  actions?: ReactNode
  className?: string
}

type EntityRowProps = FilledEntityRowProps | EmptyEntityRowProps

/**
 * Per-ontology tone (see `--color-sheet-*` in theme.css), read as `Card` reads
 * it: `band` is the header fill, `ink` the text that sits legibly on it.
 *
 * ## Why there is no `rail` or `wash`
 *
 * Neither an edge bar nor a tinted body is how a card says its ontology. A card
 * states it **in a solid band across
 * the top**, over a paper body: the tone is a header, not an edge, and the
 * content sits on paper so black text is black text everywhere in the system.
 * Rows are the compact translation of that card, so they say it the same way.
 *
 * The practical gain is legibility, not just consistency: a tinted body would
 * put every quiet chip, stat and button on a slightly different ground per
 * ontology, and an edge bar spends the highest-contrast element on the row on
 * decoration.
 *
 * Pilot, mech and game take ink text: the origin draws ink on the unit colour,
 * and paper on pilot orange fails contrast. Crawler pink carries neither ink
 * (4.2 : 1) nor paper (3.7 : 1) at the 4.5 : 1 the 16px title needs, so the
 * crawler band is the deeper `--color-crawler-band` with paper on it (4.6 : 1,
 * ruleset §3.8) — the a11y scan of /starter fails the plain pink.
 */
const TONE: Record<EntityRowType, { band: string; ink: string }> = {
  pilot: { band: 'var(--color-sheet-pilot)', ink: 'var(--color-ink)' },
  mech: { band: 'var(--color-sheet-mech)', ink: 'var(--color-ink)' },
  crawler: { band: 'var(--color-crawler-band)', ink: 'var(--color-paper)' },
  game: { band: 'var(--color-sheet-game)', ink: 'var(--color-ink)' },
  // A built NPC wears the Denizens' adversary brown, as a reference NPC's card
  // does; what marks it as a player's is the dashed frame (`USER_MADE`).
  npc: { band: 'var(--color-adversary)', ink: 'var(--color-paper)' },
}

/**
 * Normalise a one-or-many node prop to a list, dropping the empties so a caller
 * passing `undefined` (or a falsy conditional) renders nothing rather than an
 * empty chip.
 */
function toNodes(value: ReactNode | ReactNode[]): ReactNode[] {
  return (Array.isArray(value) ? value : [value]).filter(
    (node) => node !== null && node !== undefined && node !== false && node !== ''
  )
}

/** Per-ontology "missing entity" glyph for the empty variant (decorative). */
const EMPTY_GLYPH: Record<EntityRowType, LucideIcon> = {
  pilot: UserRound,
  mech: Bot,
  crawler: Warehouse,
  game: Users,
  npc: UserRound,
}

// — Empty variant —

const EMPTY_ROW = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'dashed',
  borderWidth: borderWidth.entity,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflow: 'hidden',
} satisfies CSSProperties

const EMPTY_BAND = {
  alignItems: 'center',
  display: 'flex',
  paddingBlock: space[6],
  paddingInline: space[10],
} satisfies CSSProperties

const EMPTY_BODY = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[12],
  paddingBlock: space[8],
  paddingInline: space[10],
} satisfies CSSProperties

const EMPTY_GLYPH_BOX = {
  flexShrink: 0,
  height: space[24],
  width: space[24],
} satisfies CSSProperties

const EMPTY_MESSAGE = {
  color: color.ink,
  flex: 1,
  fontFamily: font.body,
  fontSize: fontSize.note,
  // The snug leading.
  lineHeight: 1.375,
  margin: 0,
  minWidth: '140px',
} satisfies CSSProperties

/** The dashed foot: only its top edge is drawn, so the other three widths are 0. */
const EMPTY_FOOT = {
  alignItems: 'stretch',
  borderColor: color.ink,
  borderStyle: 'dashed',
  borderWidth: `${borderWidth.pill} 0 0`,
  display: 'flex',
  gap: space[8],
  marginTop: 'auto',
  paddingBlock: space[6],
  paddingInline: space[10],
} satisfies CSSProperties

// — Filled variant —

const ROW_FRAME = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderWidth: borderWidth.entity,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'visible',
  position: 'relative',
} satisfies CSSProperties

/** Clips the bands to the frame's radius. */
const ROW_CLIP = {
  borderRadius: 'calc(var(--radius-card) - var(--bw-entity))',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
} satisfies CSSProperties

const ROW_BAND = {
  alignItems: 'center',
  columnGap: space[12],
  display: 'flex',
  flexWrap: 'wrap',
  minWidth: 0,
  paddingBottom: space[6],
  paddingInline: space[10],
  rowGap: space[6],
} satisfies CSSProperties

const ROW_TITLE = {
  alignSelf: 'center',
  fontFamily: font.cond,
  fontSize: fontSize.base,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1,
  minWidth: 0,
  overflowWrap: 'break-word',
  textTransform: 'uppercase',
  width: 'fit-content',
} satisfies CSSProperties

const ROW_STATS = {
  alignItems: 'center',
  columnGap: space[8],
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  marginLeft: 'auto',
  rowGap: space[4],
} satisfies CSSProperties

const ROW_BODY = {
  alignItems: 'center',
  columnGap: space[12],
  display: 'flex',
  flex: 1,
  flexWrap: 'wrap',
  minWidth: 0,
  paddingBlock: space[8],
  paddingInline: space[10],
  rowGap: space[8],
} satisfies CSSProperties

const ROW_DETAILS = {
  alignItems: 'center',
  columnGap: space[8],
  display: 'flex',
  flex: 1,
  flexWrap: 'wrap',
  minWidth: '9rem',
  rowGap: space[4],
} satisfies CSSProperties

const ROW_CHIP = {
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const ROW_CONTROLS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[6],
  justifyContent: 'flex-end',
  marginLeft: 'auto',
} satisfies CSSProperties

const VIEW_LINK = { textDecorationLine: 'none' } satisfies CSSProperties

const UNASSIGN_GLYPH = { height: space[14], width: space[14] } satisfies CSSProperties

/** Static half of the Delete button; its colours are `.entity-row__delete`. */
const DELETE_BUTTON = {
  borderColor: 'transparent',
  paddingInline: space[8],
} satisfies CSSProperties

const DELETE_GLYPH = { height: space[16], width: space[16] } satisfies CSSProperties

const SEAL_INSET = { right: space[12] } satisfies CSSProperties

export function EntityRow(props: EntityRowProps) {
  const tone = TONE[props.entityType]

  // Empty variant — the dashed placeholder slot.
  if (props.empty) {
    const { roleLabel, message, mock, actions, className } = props
    const EmptyGlyph = EMPTY_GLYPH[props.entityType]
    return (
      <div className={className} style={EMPTY_ROW}>
        {/* The role tab rides its own tone band, the same way the filled row's
            name does — an empty slot is still a slot for a KIND of thing, and
            it should announce which one in the same place its filled sibling
            would. Dashed frame is what marks it empty; the band is not. */}
        <div style={{ ...EMPTY_BAND, background: tone.band, color: tone.ink }}>
          <Badge shape="stamp" size="compact">
            {roleLabel}
          </Badge>
        </div>
        <div style={EMPTY_BODY}>
          <EmptyGlyph aria-hidden="true" style={{ ...EMPTY_GLYPH_BOX, color: tone.band }} />
          {mock}
          <p style={EMPTY_MESSAGE}>{message}</p>
        </div>
        {actions && (
          <div className="entity-row__empty-actions" style={EMPTY_FOOT}>
            {actions}
          </div>
        )}
      </div>
    )
  }

  const {
    entityType,
    name,
    stats,
    bodyStats,
    meta,
    metaLine,
    seal,
    sheetHref,
    onDeleteClick,
    onUnassignClick,
    actions,
    linkAs: Link = 'a',
  } = props
  // `meta` accepts one node or several. Normalise to a list, dropping empties so
  // a caller passing `undefined` (or a falsy conditional) renders no badge at
  // all rather than an empty one.
  const metaBadges = toNodes(meta)
  const captionParts = toNodes(metaLine)
  const hasStats = (stats?.length ?? 0) > 0
  const hasBody =
    captionParts.length > 0 ||
    metaBadges.length > 0 ||
    (bodyStats?.length ?? 0) > 0 ||
    !!actions ||
    sheetHref !== undefined ||
    !!onUnassignClick ||
    !!onDeleteClick

  return (
    <div
      style={{
        // `overflow: visible` (ROW_FRAME), so the seal can ride the top border:
        // a clipped frame would slice the stamp in half along the seam it is
        // meant to straddle. The inner wrapper does the clipping instead — the
        // same split `Card` uses for its callout.
        //
        // The frame is the card's, at the card's weight — a row is the compact
        // translation of an entity card, not a lighter-weight cousin of one.
        // Flat chrome (brand refresh P2a), as `Card`: no drop shadow and no
        // hover lift; the row is printed on the page and the frame is its edge.
        ...ROW_FRAME,
        // A built NPC is user-made (ruleset §3.9), so its frame is dashed. The
        // caller seals it with the User-made stamp, which is what tells it from
        // an empty slot's dashed frame.
        borderStyle: entityType === 'npc' ? 'dashed' : 'solid',
      }}
    >
      {/* Inner wrapper clips the bands to the frame's radius. */}
      <div style={ROW_CLIP}>
        {/* HEADER BAND — the card's, in row form: a solid strip of the ontology
            tone carrying the name stamp on the left and the row's vitals on the
            right. This is where the row states what kind of thing it is and how
            it is doing.

            Stats sit HERE rather than in the body because they are what you scan
            a roster for — HP, SP, Heat, the chassis — and the body is where the
            things you press live. The top padding grows when a seal is present,
            clearing the stamp riding the border above (the same allowance
            `Card` makes for its callout). */}
        <div
          style={{
            ...ROW_BAND,
            // Only extra TOP padding, no right reserve: the seal rides the
            // border half above the frame, so its intrusion is vertical, and
            // clearing it downward frees the band's right edge for the stats
            // (which a 96px right reserve had stranded in the middle of the band).
            //
            // The clearance is generous on purpose. The stats sit at the same
            // right edge the seal hangs over, so a tight allowance left the
            // stamp appearing to rest ON the first stat plate rather than on
            // the border above it — two black plates a hair apart, reading as
            // one smudged stack.
            paddingTop: seal ? space[20] : space[6],
            background: tone.band,
            color: tone.ink,
          }}
        >
          {/* The title, under the ENTITY CARD's title rule (`EntityCardHeader`):
              plain ink text sitting directly ON the tone — no ink
              name-tab block behind it — condensed, bold, uppercase, tight caps
              tracking, hugging its own text rather than filling the band.

              It was a black stamp plate, which is the treatment cards use for
              their SEAM tags and eyebrows, not for a name. Two different
              answers to "how does an entity announce itself" in one system was
              the drift; the card's is the one that wins, so a row's title and a
              card's title are now the same object at a different rung.

              `fontSize.base` is the ladder's `small` rung at depth 0 — a row is
              the card's compact translation, so it sits where a small card
              sits, and it is meaningfully larger than the stamp it replaces.

              `overflowWrap: break-word` so an unbreakable token wraps instead
              of running under the stat cluster beside it. */}
          <span style={{ ...ROW_TITLE, color: tone.ink }}>{name}</span>
          {hasStats && (
            <div style={ROW_STATS}>
              {stats?.map((stat) => (
                <Stat
                  key={String(stat.label)}
                  label={stat.label}
                  value={stat.value}
                  orientation="horizontal"
                  size="mini"
                />
              ))}
            </div>
          )}
        </div>

        {/* BODY — paper, like a card's. The row's DETAILS and its VERBS: the
            class/role badges, the caption chips, and the controls. Vitals are
            not here; they are in the band above, where they can be scanned down
            a column without reading past the buttons.

            Rendered only when there is something to put in it — a row that is
            just a name and its stats closes at the band rather than opening an
            empty strip beneath it. */}
        {hasBody && (
          <div style={ROW_BODY}>
            {/* `minWidth` is a wrap TRIGGER, not a width: without it the detail
                block shrinks to whatever the controls leave behind, and a row
                with four buttons truncated its chips rather than dropping the
                controls to their own line. */}
            <div style={ROW_DETAILS}>
              {/* The SECONDARY stats — the same cell as the band's, in the
                  quieter register. See `bodyStats`. */}
              {bodyStats?.map((stat) => (
                <Stat
                  key={String(stat.label)}
                  label={stat.label}
                  value={stat.value}
                  orientation="horizontal"
                  size="mini"
                />
              ))}
              {/* The class/role badge is keyed to the entity's ontology tone
                  (pilot → orange, mech → green, crawler → pink, game → blue). */}
              {metaBadges.map((badge, i) => (
                <Badge
                  // biome-ignore lint/suspicious/noArrayIndexKey: static per-render list that never reorders; a count badge's text changes as the count does, so content is a worse key than position
                  key={i}
                  surface={entityType === 'npc' ? 'quiet' : 'tone'}
                  {...(entityType === 'npc' ? {} : { tone: entityType })}
                  style={ROW_CHIP}
                >
                  {badge}
                </Badge>
              ))}
              {captionParts.map((part, i) =>
                typeof part === 'string' || typeof part === 'number' ? (
                  <Badge
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional caption parts that never reorder; a value is a worse key than its slot
                    key={i}
                    surface="quiet"
                    style={ROW_CHIP}
                  >
                    {part}
                  </Badge>
                ) : (
                  // A node — a cross-link anchor wrapping its own Stat — so it
                  // renders as given rather than nested inside another cell.
                  // biome-ignore lint/suspicious/noArrayIndexKey: as above
                  <Fragment key={i}>{part}</Fragment>
                )
              )}
            </div>

            {/* The controls, trailing the body. They do not compete with the
                name for width — the name has its own band above — so this is a
                plain right-aligned cluster that wraps when it must. */}
            <div style={ROW_CONTROLS}>
              {actions}
              {sheetHref !== undefined && (
                <Link
                  href={sheetHref}
                  // The visible label is "View" on every row, so without this
                  // every link in a rail has the same accessible name and a
                  // screen-reader user hears "View, View, View" with no way to
                  // tell which unit each one opens (WCAG 2.4.4, link purpose
                  // from its name). The visible text stays "View" — the rail is
                  // tight and the name already has its own band above.
                  aria-label={`View ${name}`}
                  className={buttonVariants({ variant: 'default', size: 'mini' })}
                  style={VIEW_LINK}
                >
                  View
                </Link>
              )}
              {onUnassignClick && (
                <Button
                  variant="ghost"
                  size="mini"
                  // The visible text is "Unassign" on every row; the name says
                  // which assignment it ends, as View's does (WCAG 2.4.4).
                  aria-label={`Unassign ${name}`}
                  onClick={onUnassignClick}
                  glyph={<Unlink style={UNASSIGN_GLYPH} />}
                >
                  Unassign
                </Button>
              )}
              {onDeleteClick && (
                <Button
                  variant="ghost"
                  size="mini"
                  aria-label={`Delete ${name}`}
                  onClick={onDeleteClick}
                  className="entity-row__delete"
                  style={DELETE_BUTTON}
                >
                  <Trash2 aria-hidden="true" style={DELETE_GLYPH} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* The seal RIDES THE TOP BORDER — the canonical stamp-seam placement
          (`STAMP_SEAM`), half above the frame and half over it, like a label
          plate riveted across the seam. It is outside the clipping wrapper for
          exactly that reason; the band's extra top padding is what keeps its
          contents clear of the half that overhangs them. */}
      {seal && (
        <span className={STAMP_SEAM} style={SEAL_INSET}>
          {seal}
        </span>
      )}
    </div>
  )
}
