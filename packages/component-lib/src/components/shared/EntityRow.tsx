import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Bot, type LucideIcon, Trash2, UserRound, Warehouse } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { buttonVariants } from '../chrome/buttonVariants'
import { Stat } from './Stat'

/**
 * EntityRow — a header-only clickable listing ROW: the compact, one-line
 * translation of a `DisplayCard` for roster / index surfaces.
 *
 * Anatomy (grounded in ITUN's `EntityListItem`, re-composed on canon atoms):
 * a hover-lift frame (2px ink border, faint tone-wash background) fronted by a
 * 6px deep-tone LEFT accent rail keyed to entity ontology (pilot → orange,
 * mech → green, crawler → pink — the `--color-sheet-*` tokens), a black name
 * tab (Barlow Semi Condensed, white-on-ink, caps at 0.04em tracking), an
 * optional muted meta caption beneath it, and trailing View (link) + Delete
 * (ghost trash) actions. Neither action is the rust action colour — a row
 * navigates and removes, it never performs a true game action.
 *
 * Data-source agnostic: View renders `linkAs` (a plain `<a>` by default) styled
 * with `buttonVariants`, so the primitive works with any router or none — an
 * app with client-side routing injects its own Link rather than the row taking
 * a router dependency.
 */

export type EntityRowType = 'pilot' | 'mech' | 'crawler'

/** A single `label | value` stat rendered in the subheader as a horizontal Stat. */
export type EntityRowStat = {
  label: string | number
  value: string | number
}

/** The filled row: a linked player entity. */
type FilledEntityRowProps = {
  /** Entity ontology driving the accent rail + tone wash. */
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
  /** Optional class/role label beside the stats — rendered as an ontology-toned
   * Badge (pilot → orange, mech → green, crawler → pink), never plain prose. */
  meta?: ReactNode
  /**
   * Free-form caption under the name tab — muted, single-line, truncating.
   *
   * Distinct from `meta`: `meta` is the entity's CLASS/ROLE and renders as an
   * ontology-toned Badge, whereas this line carries arbitrary nodes such as a
   * callsign and `↳ Name` cross-links to other sheets. Links inside a toned
   * Badge would be illegible, which is why these are two props and not one.
   */
  metaLine?: ReactNode
  /** Destination for the View link. */
  sheetHref: string
  /**
   * Element the View link renders as (default `'a'`). Pass an app's router Link
   * to get client-side navigation; it receives `href` and `className`.
   */
  linkAs?: ElementType
  /** Fired when the ghost trash Delete button is pressed. Omit to hide the
   * Delete button entirely (e.g. read-only poster surfaces). */
  onDeleteClick?: () => void
}

/**
 * The EMPTY row: a dashed placeholder slot for an unfilled link (e.g. a pilot
 * with no assigned mech). Keeps the ontology tone wash + a black role tab, over
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
 * Per-ontology tone pair (see `--color-sheet-*` in theme.css): `rail` is the
 * deep tone driving the 6px accent bar; `wash` is a faint tint of the base tone
 * mixed into paper so the row reads coloured without fighting the ink text.
 */
const TONE: Record<EntityRowType, { rail: string; wash: string }> = {
  pilot: {
    rail: 'var(--color-sheet-pilot-deep)',
    wash: 'color-mix(in srgb, var(--color-sheet-pilot) 10%, var(--color-paper))',
  },
  mech: {
    rail: 'var(--color-sheet-mech-deep)',
    wash: 'color-mix(in srgb, var(--color-sheet-mech) 12%, var(--color-paper))',
  },
  crawler: {
    rail: 'var(--color-sheet-crawler-deep)',
    wash: 'color-mix(in srgb, var(--color-sheet-crawler) 11%, var(--color-paper))',
  },
}

/** Per-ontology "missing entity" glyph for the empty variant (decorative). */
const EMPTY_GLYPH: Record<EntityRowType, LucideIcon> = {
  pilot: UserRound,
  mech: Bot,
  crawler: Warehouse,
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
          'flex min-w-0 flex-col overflow-hidden rounded-card border-2 border-dashed border-ink',
          className
        )}
        style={{ background: tone.wash }}
      >
        {/* Black role tab — the same canonical stamp atom the filled variant's
            name tab uses, not a hand-rolled span. */}
        <Badge shape="stamp" size="compact" className="self-start">
          {roleLabel}
        </Badge>
        <div className="flex flex-wrap items-center gap-3 px-2.5 py-2">
          <EmptyGlyph aria-hidden="true" className="size-6 shrink-0" style={{ color: tone.rail }} />
          {mock}
          <p
            className="m-0 min-w-[140px] flex-1 font-body text-note leading-snug"
            style={{ color: tone.rail }}
          >
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
    sheetHref,
    onDeleteClick,
    linkAs: Link = 'a',
  } = props
  const frameStyle: CSSProperties = { background: tone.wash }

  return (
    <div
      className={cn(
        'group relative flex items-stretch overflow-hidden rounded-card border-2 border-ink',
        'shadow-[0_1px_0_rgba(40,32,25,0.05)] transition-all duration-200',
        'md:hover:-translate-y-0.5 md:hover:shadow-[0_7px_18px_rgba(40,32,25,0.16)]'
      )}
      style={frameStyle}
    >
      {/* Deep-tone accent rail — the entity card's left body accent, in row form */}
      <span
        aria-hidden="true"
        className="w-[6px] shrink-0 self-stretch"
        style={{ background: tone.rail }}
      />

      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {/* Black name tab — the canonical stamp, not a hand-rolled span. It
              was the latter (rounded-pip, its own padding/size), which is the
              drift the stamp atom exists to prevent. */}
          <Badge shape="stamp" size="full" className="block max-w-full truncate align-middle">
            {name}
          </Badge>
          {metaLine && (
            <div className="mt-1.5 truncate font-body text-xs text-wk-muted">{metaLine}</div>
          )}
          {(meta || (stats && stats.length > 0)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* Subheader info is only stats or toned badges — the class/role
                  line is a badge keyed to the entity's ontology tone (pilot →
                  orange, mech → green, crawler → pink). */}
              {meta && (
                <Badge surface="tone" tone={entityType} className="max-w-full truncate">
                  {meta}
                </Badge>
              )}
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

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={sheetHref}
            className={cn(buttonVariants({ variant: 'default', size: 'compact' }), 'no-underline')}
          >
            View
          </Link>
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
    </div>
  )
}
