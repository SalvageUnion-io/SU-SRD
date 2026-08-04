import { Fragment, isValidElement } from 'react'
import type { ElementType, ReactNode } from 'react'
import { Bot, type LucideIcon, Trash2, UserRound, Users, Warehouse } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { buttonVariants } from '../chrome/buttonVariants'
import { STAMP_SEAM } from '../chrome/stampSeam'
import { Stat } from './Stat'

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
 *   │   rule (`EntityCardHeader`): paper-white text directly on the tone, no
 *   │   ink block behind it, at the size ladder's `small` rung.
 *   │ ▸ BODY — paper. Ontology-toned meta badges, quiet caption chips, and the
 *   │   trailing View / Delete controls. Details, and verbs.
 *   └──────────────────────────────────┘
 *
 * Vitals live in the BAND, not the body, because they are what a roster is
 * scanned for: a column of forty rows should let the eye run down HP or SP
 * without crossing the buttons. The body is where the things you press live.
 *
 * It previously said its ontology twice and in neither of the card's ways: a
 * 6px deep-tone rail down the left edge, over a body tinted ~10% with the same
 * tone. Both are gone. A card states its kind in a band across the top and puts
 * its content on paper, so a row does too — which also means every chip, stat
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
 */

/**
 * `game` is the shared table (ADR-030), not a game-data entity — it lists
 * alongside the three player entities because it is another thing you own and
 * open, and it carries its own tone so a Game row never reads as a crawler row.
 */
export type EntityRowType = 'pilot' | 'mech' | 'crawler' | 'game'

/** A single `label | value` stat rendered in the subheader as a horizontal Stat. */
export type EntityRowStat = {
  label: string | number
  value: string | number
}

/**
 * A `label | value` DETAIL in the row's body — the same horizontal `Stat` cell
 * the band uses, tinted on its label plate by ontology.
 *
 * Details are the body's whole vocabulary. They were loose badges (`"GHOST"`,
 * `SCAVENGER`, `IRON JAW`) which stated a value with no name attached: the
 * reader had to infer that one was a callsign, one a class and one a linked
 * mech, from nothing but position and colour. A `Stat` says which is which —
 * `CALLSIGN | Ghost`, `CLASS | Scavenger` — and it is the primitive every other
 * `label | value` in the system already renders through (ruleset §3.7).
 *
 * `tone` tints the LABEL plate only, which is the sanctioned chip role for
 * `Stat` (see its `bgColor` docs): the value stays ink-canonical, so a cell
 * carries its ontology without spending the value's legibility on it.
 */
export type EntityRowDetail = {
  label: string | number
  value: string | number
  /** Ontology tint for the label plate. Omit for the quiet default. */
  tone?: EntityRowType
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
   * Subheader stat content. Each entry renders through the canonical
   * Stat (horizontal `label | value` mode) — never hand-assembled text
   * (see the stats-render-through-Stat law, ruleset §3).
   */
  stats?: EntityRowStat[]
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
   * The row's DETAILS, rendered in the body beneath the band.
   *
   * Each entry is either an `EntityRowDetail` (`label | value`, rendered as a
   * tinted horizontal `Stat`) or a ReactNode, rendered as given — which is how
   * a cross-link arrives, since only the app knows how to build its own router
   * link. Bare strings still render as quiet chips, for a caller with a value
   * and genuinely no name for it.
   *
   * It began as one free-form node that callers joined with ' · ' separators
   * into a muted grey line, became a row of chips, and is now stats: each step
   * removed an inference the reader was making for the row. A chip saying
   * "Ghost" is a value with its name rubbed off.
   */
  metaLine?: ReactNode | Array<ReactNode | EntityRowDetail>
  /**
   * A stamp pinned to the row's TOP-RIGHT corner — the mark applied ON the
   * record about its status, as distinct from `actions` (things you do to it)
   * and `meta` (what it is).
   *
   * A slot rather than a typed prop for the same reason `actions` is one: what
   * a row is stamped with belongs to the surface listing it. The Game roster
   * stamps ownership here (`UNCLAIMED` / `YOU` / a crewmate's name, ADR-030
   * D32); a personal roster stamps nothing at all.
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
   * Extra trailing controls, rendered before View/Delete.
   *
   * Deliberately a slot rather than a set of named props: what a row can do
   * depends on the surface it is listed on, and the two known consumers already
   * disagree — a personal roster row navigates and deletes, while a shared
   * Game row may also be picked up, offered back to the crew, or launched into
   * the Dashboard. Teaching this primitive those verbs would push ownership,
   * accounts and routing into a package whose contract is to know about none of
   * them (the same reasoning as the owner chip's, ADR-030 D32).
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
 * ## Why there is no longer a `rail` or a `wash`
 *
 * The row used to carry its ontology two ways at once — a 6px deep-tone bar
 * down the left edge, over a body tinted ~10% with the same tone — and neither
 * is how a card says it. A card states its ontology **in a solid band across
 * the top**, over a paper body: the tone is a header, not an edge, and the
 * content sits on paper so black text is black text everywhere in the system.
 * Rows are the compact translation of that card, so they say it the same way.
 *
 * The practical gain is legibility, not just consistency. A tinted body meant
 * every quiet chip, stat and button on the row sat on a slightly different
 * ground per ontology, and the rail put a hard 6px of `crawler-deep` against a
 * pink wash — the highest-contrast element on the row spent on decoration.
 *
 * `crawler` takes paper text for the same reason its Badge tone does: it is the
 * one dark fill in the ramp.
 */
const TONE: Record<EntityRowType, { band: string; ink: string }> = {
  pilot: { band: 'var(--color-sheet-pilot)', ink: 'var(--color-ink)' },
  mech: { band: 'var(--color-sheet-mech)', ink: 'var(--color-ink)' },
  crawler: { band: 'var(--color-sheet-crawler)', ink: 'var(--color-paper)' },
  game: { band: 'var(--color-sheet-game)', ink: 'var(--color-ink)' },
}

/**
 * Normalise a one-or-many node prop to a list, dropping the empties so a caller
 * passing `undefined` (or a falsy conditional) renders nothing rather than an
 * empty chip.
 */
function toEntries(
  value: ReactNode | Array<ReactNode | EntityRowDetail>
): Array<ReactNode | EntityRowDetail> {
  return (Array.isArray(value) ? value : [value]).filter(
    (node) => node !== null && node !== undefined && node !== false && node !== ''
  )
}

/** The node-only flavour, for `meta` — which never carries details. */
function toNodes(value: ReactNode | ReactNode[]): ReactNode[] {
  return (Array.isArray(value) ? value : [value]).filter(
    (node) => node !== null && node !== undefined && node !== false && node !== ''
  )
}

/**
 * Is this entry a `label | value` detail rather than something to render as-is?
 *
 * `isValidElement` is checked FIRST because a React element is also a plain
 * object, and a component whose props happened to include `label` would
 * otherwise be mistaken for a detail and rendered as a stat.
 */
function isDetail(entry: ReactNode | EntityRowDetail): entry is EntityRowDetail {
  return (
    !isValidElement(entry) &&
    typeof entry === 'object' &&
    entry !== null &&
    'label' in entry &&
    'value' in entry
  )
}

/** Per-ontology "missing entity" glyph for the empty variant (decorative). */
const EMPTY_GLYPH: Record<EntityRowType, LucideIcon> = {
  pilot: UserRound,
  mech: Bot,
  crawler: Warehouse,
  game: Users,
}

export function EntityRow(props: EntityRowProps) {
  const tone = TONE[props.entityType]

  // Empty variant — the dashed placeholder slot.
  if (props.empty) {
    const { roleLabel, message, mock, actions, className } = props
    const EmptyGlyph = EMPTY_GLYPH[props.entityType]
    return (
      <div
        className={cn(
          'flex min-w-0 flex-col overflow-hidden rounded-card bg-paper',
          'border-[length:var(--bw-entity)] border-dashed border-ink',
          className
        )}
      >
        {/* The role tab rides its own tone band, the same way the filled row's
            name does — an empty slot is still a slot for a KIND of thing, and
            it should announce which one in the same place its filled sibling
            would. Dashed frame is what marks it empty; the band is not. */}
        <div
          className="flex items-center px-2.5 py-1.5"
          style={{ background: tone.band, color: tone.ink }}
        >
          <Badge shape="stamp" size="compact">
            {roleLabel}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-2.5 py-2">
          <EmptyGlyph aria-hidden="true" className="size-6 shrink-0" style={{ color: tone.band }} />
          {mock}
          <p className="m-0 min-w-[140px] flex-1 font-body text-note leading-snug text-ink">
            {message}
          </p>
        </div>
        {actions && (
          <div className="mt-auto flex items-stretch gap-2 border-t-2 border-dashed border-ink px-2.5 py-1.5 *:flex-1">
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
    meta,
    metaLine,
    seal,
    sheetHref,
    onDeleteClick,
    actions,
    linkAs: Link = 'a',
  } = props
  // `meta` accepts one node or several. Normalise to a list, dropping empties so
  // a caller passing `undefined` (or a falsy conditional) renders no badge at
  // all rather than an empty one.
  const metaBadges = toNodes(meta)
  const captionParts = toEntries(metaLine)
  const hasStats = (stats?.length ?? 0) > 0
  const hasBody =
    captionParts.length > 0 ||
    metaBadges.length > 0 ||
    !!actions ||
    sheetHref !== undefined ||
    !!onDeleteClick

  return (
    <div
      className={cn(
        // `overflow-visible`, so the seal can ride the top border: a clipped
        // frame would slice the stamp in half along the seam it is meant to
        // straddle. The inner wrapper does the clipping instead — the same
        // split `Card` uses for its callout.
        'group relative flex flex-col overflow-visible rounded-card bg-paper',
        // The frame is the card's, at the card's weight — a row is the compact
        // translation of an entity card, not a lighter-weight cousin of one.
        'border-[length:var(--bw-entity)] border-ink',
        'shadow-[0_1px_0_var(--color-ink-8)] transition-all duration-200',
        'md:hover:-translate-y-0.5 md:hover:shadow-[0_7px_18px_var(--color-ink-20)]'
      )}
    >
      {/* Inner wrapper clips the bands to the frame's radius. */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ borderRadius: 'calc(var(--radius-card) - var(--bw-entity))' }}
      >
        {/* HEADER BAND — the card's, in row form: a solid strip of the ontology
            tone carrying the name stamp on the left and the row's vitals on the
            right. This is where the row states what kind of thing it is and how
            it is doing, replacing the left rail + tinted body it used to say the
            first half with.

            Stats sit HERE rather than in the body because they are what you scan
            a roster for — HP, SP, Heat, the chassis — and the body is where the
            things you press live. The top padding grows when a seal is present,
            clearing the stamp riding the border above (the same allowance
            `Card` makes for its callout). */}
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-1.5',
            // Only extra TOP padding, no right reserve: the seal rides the
            // border half above the frame, so its intrusion is vertical, and
            // clearing it downward frees the band's right edge for the stats
            // (which a `pr-24` reserve had stranded in the middle of the band).
            seal && 'pt-3'
          )}
          style={{ background: tone.band, color: tone.ink }}
        >
          {/* The title, under the ENTITY CARD's title rule (`EntityCardHeader`):
              plain paper-white text sitting directly ON the tone — no ink
              name-tab block behind it — condensed, bold, uppercase, tight caps
              tracking, hugging its own text rather than filling the band.

              It was a black stamp plate, which is the treatment cards use for
              their SEAM tags and eyebrows, not for a name. Two different
              answers to "how does an entity announce itself" in one system was
              the drift; the card's is the one that wins, so a row's title and a
              card's title are now the same object at a different rung.

              `text-base` is the ladder's `small` rung at depth 0 — a row is the
              card's compact translation, so it sits where a small card sits,
              and it is meaningfully larger than the stamp it replaces.

              `break-words` so an unbreakable token wraps instead of running
              under the stat cluster beside it. */}
          <span
            className={cn(
              'w-fit min-w-0 self-center break-words',
              'font-cond text-base font-bold uppercase leading-none tracking-caps-tight',
              'text-paper'
            )}
          >
            {name}
          </span>
          {hasStats && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
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
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 px-2.5 py-2">
            {/* `min-w` is a wrap TRIGGER, not a width: without it the detail
                block shrinks to whatever the controls leave behind, and a row
                with four buttons truncated its chips rather than dropping the
                controls to their own line. */}
            <div className="flex min-w-[9rem] flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              {/* The class/role badge is keyed to the entity's ontology tone
                  (pilot → orange, mech → green, crawler → pink, game → blue). */}
              {metaBadges.map((badge, i) => (
                <Badge
                  // biome-ignore lint/suspicious/noArrayIndexKey: static per-render list that never reorders; a count badge's text changes as the count does, so content is a worse key than position
                  key={i}
                  surface="tone"
                  tone={entityType}
                  className="max-w-full truncate"
                >
                  {badge}
                </Badge>
              ))}
              {captionParts.map((part, i) =>
                isDetail(part) ? (
                  <Stat
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional detail cells that never reorder; a callsign is a worse key than its slot
                    key={i}
                    label={part.label}
                    value={part.value}
                    orientation="horizontal"
                    size="mini"
                    // Tint the LABEL plate only — the value stays ink-canonical,
                    // which is the sanctioned chip role for a Stat.
                    bgColor={part.tone ? TONE[part.tone].band : undefined}
                    textColor={part.tone ? TONE[part.tone].ink : undefined}
                  />
                ) : typeof part === 'string' || typeof part === 'number' ? (
                  <Badge
                    // biome-ignore lint/suspicious/noArrayIndexKey: as above
                    key={i}
                    surface="quiet"
                    className="max-w-full truncate"
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

            {/* The controls, trailing the body. They no longer compete with the
                name for width — the name has its own band above — so this is a
                plain right-aligned cluster that wraps when it must. */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              {actions}
              {sheetHref !== undefined && (
                <Link
                  href={sheetHref}
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'compact' }),
                    'no-underline'
                  )}
                >
                  View
                </Link>
              )}
              {onDeleteClick && (
                <Button
                  variant="ghost"
                  size="compact"
                  aria-label={`Delete ${name}`}
                  onClick={onDeleteClick}
                  className="border-transparent px-2 text-status-bad hover:bg-transparent hover:text-status-bad"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
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
      {seal && <span className={cn(STAMP_SEAM, 'right-3')}>{seal}</span>}
    </div>
  )
}
