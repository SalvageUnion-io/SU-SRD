import type { CSSProperties, ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Btn } from '../chrome/Btn'
import { btnVariants } from '../chrome/btnVariants'
import { StatDisplay } from './StatDisplay'

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
 * Data-source agnostic: View renders a plain `<a>` styled with `btnVariants`
 * so the primitive works with any router (or none).
 */

export type EntityRowType = 'pilot' | 'mech' | 'crawler'

/** A single `label | value` stat rendered in the subheader as a horizontal StatDisplay. */
export type EntityRowStat = {
  label: string | number
  value: string | number
}

type EntityRowProps = {
  /** Entity ontology driving the accent rail + tone wash. */
  entityType: EntityRowType
  /** Entity name rendered in the black pseudoheader name tab. */
  name: string
  /**
   * Subheader stat content. Each entry renders through the canonical
   * StatDisplay (horizontal `label | value` mode) — never hand-assembled text
   * (see the stats-render-through-StatDisplay law, ruleset §3).
   */
  stats?: EntityRowStat[]
  /** Optional muted prose caption beside the stats (e.g. a class/role line). */
  meta?: ReactNode
  /** Destination for the View link. */
  sheetHref: string
  /** Fired when the ghost trash Delete button is pressed. */
  onDeleteClick: () => void
}

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

export function EntityRow({
  entityType,
  name,
  stats,
  meta,
  sheetHref,
  onDeleteClick,
}: EntityRowProps) {
  const tone = TONE[entityType]
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
          {/* Black name tab — the reference card's condensed-caps title box */}
          <span className="inline-block max-w-full truncate rounded-pip bg-ink px-1.5 py-0.5 align-middle font-cond text-lede font-bold uppercase leading-tight tracking-caps-tight text-paper">
            {name}
          </span>
          {(meta || (stats && stats.length > 0)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {meta && <span className="truncate font-body text-note text-wk-muted">{meta}</span>}
              {stats?.map((stat) => (
                <StatDisplay
                  key={String(stat.label)}
                  label={stat.label}
                  value={stat.value}
                  orientation="horizontal"
                  xs
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={sheetHref}
            className={cn(btnVariants({ variant: 'default', size: 'sm' }), 'no-underline')}
          >
            View
          </a>
          <Btn
            variant="ghost"
            size="sm"
            aria-label={`Delete ${name}`}
            onClick={onDeleteClick}
            className="border-transparent px-2 text-danger hover:bg-transparent hover:text-danger"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Btn>
        </div>
      </div>
    </div>
  )
}
