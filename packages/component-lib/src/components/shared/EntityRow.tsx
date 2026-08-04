import { Fragment } from 'react'
import type { ElementType, ReactNode } from 'react'
import { Bot, type LucideIcon, Trash2, UserRound, Users, Warehouse } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { buttonVariants } from '../chrome/buttonVariants'
import { Stat } from './Stat'

/**
 * EntityRow — a header-only clickable listing ROW: the compact, one-line
 * translation of a `Card` for roster / index surfaces.
 *
 * Anatomy — the CARD's, compressed. A row is built from the same bands an
 * entity card is, in the same order, at the same frame weight
 * (`--bw-entity`):
 *
 *   ┌──────────────────────────────────┐
 *   │ ▸ HEADER BAND — solid ontology tone, carrying the black name stamp
 *   │   (pilot → orange, mech → green, crawler → pink, game → blue, the
 *   │   `--color-sheet-*` tokens). The seal, when present, is pinned to this
 *   │   band's top-right corner.
 *   │ ▸ BODY — paper. Caption chips, ontology-toned meta badges, `Stat`s, and
 *   │   the trailing View / Delete controls.
 *   └──────────────────────────────────┘
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
   * Caption under the name tab — a wrapping row of quiet chips.
   *
   * **Every piece of text on a row is a badge.** Plain strings and numbers
   * passed here are wrapped in a quiet chip for you; nodes are rendered as
   * given, because a caller passing a node is passing something already
   * chipped (a `↳ Name` cross-link is an anchor wrapping a toned Badge, and
   * re-wrapping it would nest one badge inside another).
   *
   * Pass an ARRAY to render several chips. It used to be one free-form node
   * that callers joined with ' · ' separators into a single muted line, which
   * left the row with two vocabularies — stamped name, badged class/stats, and
   * then a run of loose grey prose underneath carrying the callsign, the
   * chassis and the owner. The separator characters were doing the work a chip
   * boundary does better.
   *
   * Distinct from `meta`: `meta` is the entity's CLASS/ROLE and takes the
   * ontology tone, whereas these are quiet — the row's tone belongs to what the
   * entity IS, not to its incidental facts.
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
  const captionParts = toNodes(metaLine)
  const hasBody = captionParts.length > 0 || metaBadges.length > 0 || (stats?.length ?? 0) > 0

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card bg-paper',
        // The frame is the card's, at the card's weight — a row is the compact
        // translation of an entity card, not a lighter-weight cousin of one.
        'border-[length:var(--bw-entity)] border-ink',
        'shadow-[0_1px_0_var(--color-ink-8)] transition-all duration-200',
        'md:hover:-translate-y-0.5 md:hover:shadow-[0_7px_18px_var(--color-ink-20)]'
      )}
    >
      {/* HEADER BAND — the card's, in row form: a solid strip of the ontology
          tone carrying the name stamp. This is where the row states what kind
          of thing it is, replacing the left rail + tinted body it used to say
          it with. `pr-24` reserves the corner the seal is pinned to. */}
      <div
        className={cn('flex min-w-0 items-center px-2.5 py-1.5', seal && 'pr-24')}
        style={{ background: tone.band, color: tone.ink }}
      >
        {/* Black name tab — the canonical stamp, not a hand-rolled span. It
            was the latter (rounded-pip, its own padding/size), which is the
            drift the stamp atom exists to prevent. */}
        <Badge shape="stamp" size="full" className="block max-w-full truncate align-middle">
          {name}
        </Badge>
      </div>

      {/* BODY — paper, like a card's. Everything that is not the name lives
          here, so chips, stats and buttons all sit on one ground regardless of
          ontology. Rendered only when there is something to put in it: a row
          with nothing but a name closes at the band rather than opening an
          empty strip under it. */}
      {(hasBody || actions || sheetHref !== undefined || onDeleteClick) && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 px-2.5 py-2">
          {/* `min-w` is a wrap TRIGGER, not a width: without it the caption
              block shrinks to whatever the controls leave behind, and a row
              with four buttons truncated "Iron Mongrel" to "IRON-MON…" rather
              than dropping the controls to their own line. */}
          <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
            {captionParts.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {captionParts.map((part, i) =>
                  typeof part === 'string' || typeof part === 'number' ? (
                    <Badge
                      // biome-ignore lint/suspicious/noArrayIndexKey: positional caption parts that never reorder; a callsign or chassis name is a worse key than its slot
                      key={i}
                      surface="quiet"
                      className="max-w-full truncate"
                    >
                      {part}
                    </Badge>
                  ) : (
                    // Already a node — a cross-link anchor wrapping its own toned
                    // Badge — so it renders as given rather than nested in a chip.
                    // biome-ignore lint/suspicious/noArrayIndexKey: as above
                    <Fragment key={i}>{part}</Fragment>
                  )
                )}
              </div>
            )}
            {(metaBadges.length > 0 || (stats && stats.length > 0)) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* Subheader info is only stats or toned badges — the class/role
                    line is a badge keyed to the entity's ontology tone (pilot →
                    orange, mech → green, crawler → pink, game → blue). */}
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

      {/* The seal owns the top-right corner outright — pulled out of the flow
          so no amount of name, caption or controls can push it somewhere else.
          The name block reserves its width with `pr-24` above, which is what
          keeps a long name from sliding underneath it. */}
      {seal && <span className="absolute right-2.5 top-2.5 z-10">{seal}</span>}
    </div>
  )
}
